"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/Locale";
import { LogoMark } from "@/components/Logo";
import { PressButton, PressLink } from "@/components/Press";
import { clearSession, loadSession, saveSession, type GroupSession } from "@/lib/groupSession";
import { explain, fetchWithin } from "@/lib/http";
import { formatMoney, formatUsd, type Currency } from "@/lib/money";
import { formatCents } from "@/lib/netting";
import { checkShares, parseMoney, type SplitMode } from "@/lib/split";
import { browserClient, supabaseConfigured } from "@/lib/supabase";
import { useUsdRate } from "@/lib/useUsdRate";

const SPRING = { type: "spring", stiffness: 380, damping: 30 } as const;

// World ID loads only where a World button is on screen, and only if configured.
const WorldButton = dynamic(() => import("@/components/WorldButton"), { ssr: false });
const WORLD_ON = Boolean(process.env.NEXT_PUBLIC_WORLD_APP_ID);
// Which World ID credential is asked for: Selfie Check, or the device credential.
const WORLD_SELFIE = process.env.NEXT_PUBLIC_WORLD_CREDENTIAL !== "device";

// Privy loads only when the payer opens their wallet — never on anyone else's path.
const PayoutWallet = dynamic(() => import("@/components/PayoutWallet"), {
  ssr: false,
  loading: () => <p className="wallet-note">…</p>,
});

interface Group {
  id: string;
  name: string;
  total_cents: number;
  payer_id: string;
  split_mode: SplitMode;
  status: "open" | "locked" | "settled";
  schedule_id: string | null;
  plan_receipt: string | null;
  currency: Currency;
  fx_usd_per_unit: number | null;
  fx_as_of: string | null;
  fx_source: string | null;
  settle_token: string | null;
  payout_evm: string | null;
  payout_account: string | null;
  require_human: boolean;
}

interface Member {
  id: string;
  name: string;
  is_admin: boolean;
  share_cents: number | null;
  settle_usd_cents: number | null;
  confirmed: boolean;
  account_index: number;
  human_verified: boolean;
}

/**
 * The table.
 *
 * One URL does everything: it is what the QR encodes, so scanning it lands a
 * newcomer on the join form, and once joined the same page becomes their view
 * of the bill. Every phone subscribes to the group, so a join, a new split or
 * a confirmation shows up on all of them as it happens.
 */
export default function GroupRoom() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLocale();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<GroupSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── loading and live updates ────────────────────────────────────────────
  // Every read is numbered. A slow read that comes back after a newer one is
  // dropped, and a session is only called stale by a read that STARTED after
  // the session existed — otherwise a list fetched a moment before someone
  // joined would say they are not at the table, and throw their seat away.
  const issued = useRef(0);
  const applied = useRef(0);
  const sessionSince = useRef(0);
  const [listSeq, setListSeq] = useState(0);

  const refresh = useCallback(async () => {
    const mine = ++issued.current;
    try {
      const res = await fetchWithin(`/api/groups/${id}`, { cache: "no-store" }, 15_000);
      const data = (await res.json()) as { group?: Group; members?: Member[]; error?: string };
      if (!res.ok || !data.group) throw new Error(data.error ?? `Error ${res.status}`);
      if (mine < applied.current) return;
      applied.current = mine;
      setGroup(data.group);
      setMembers(data.members ?? []);
      setListSeq(mine);
      setLoadError(null);
    } catch (e) {
      setLoadError(explain(e, t));
    }
  }, [id, t]);

  const adopt = useCallback(
    (s: GroupSession) => {
      saveSession(id, s);
      sessionSince.current = issued.current;
      setSession(s);
    },
    [id],
  );

  useEffect(() => {
    // A seat handed over by the admin arrives in the link's fragment, which
    // never reaches a server. Take it, then wipe it from the address bar.
    const m = window.location.hash.match(/seat=([a-z0-9]+)\.([a-f0-9]{64})/);
    if (m) {
      adopt({ memberId: m[1], secret: m[2] });
      history.replaceState(null, "", window.location.pathname);
    } else {
      sessionSince.current = issued.current;
      setSession(loadSession(id));
    }
    setSessionChecked(true);
    void refresh();
  }, [id, refresh, adopt]);

  // Realtime for the instant update; a slow poll underneath so the table
  // never goes stale if the socket quietly drops.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const soon = () => {
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => void refresh(), 120);
    };

    let channel: ReturnType<ReturnType<typeof browserClient>["channel"]> | null = null;
    if (supabaseConfigured()) {
      const db = browserClient();
      channel = db
        .channel(`group-${id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "members", filter: `group_id=eq.${id}` }, soon)
        .on("postgres_changes", { event: "*", schema: "public", table: "groups", filter: `id=eq.${id}` }, soon)
        .subscribe();
    }

    const poll = setInterval(() => void refresh(), 5000);
    return () => {
      clearInterval(poll);
      if (pending.current) clearTimeout(pending.current);
      if (channel) void browserClient().removeChannel(channel);
    };
  }, [id, refresh]);

  // ── acting as this person ───────────────────────────────────────────────
  const act = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      setBusy(action);
      setActionError(null);
      try {
        // Locking and confirming wait on Hedera; give them room, but not forever.
        const res = await fetchWithin(
          `/api/groups/${id}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action, ...session, ...extra }),
          },
          action === "lock" || action === "confirm" ? 70_000 : 20_000,
        );
        const data = (await res.json()) as Record<string, unknown> & { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
        await refresh();
        return data;
      } catch (e) {
        setActionError(explain(e, t));
        // The server may have finished after we gave up waiting: show what is true.
        void refresh();
        return null;
      } finally {
        setBusy(null);
      }
    },
    [id, session, refresh, t],
  );

  const me = useMemo(() => members.find((m) => m.id === session?.memberId) ?? null, [members, session]);

  // A saved session for a member who is no longer here is stale; drop it so
  // the join form shows instead of a broken view — but only on the word of a
  // read that began after the session did.
  useEffect(() => {
    if (session && group && members.length > 0 && !me && listSeq > sessionSince.current) {
      clearSession(id);
      setSession(null);
    }
  }, [session, group, members, me, id, listSeq]);

  const [seat, setSeat] = useState<{ name: string; url: string } | null>(null);

  // ── render states ───────────────────────────────────────────────────────
  if (loadError && !group) {
    return (
      <main className="phone">
        <div className="screen-head">
          <h1 className="title">{t("Bill not found", "No encontramos la cuenta")}</h1>
        </div>
        <div className="room-pad">
          <p className="form-error" role="alert">{loadError}</p>
          <Link href="/nuevo" className="btn btn-dark">
            {t("Start a new bill", "Empezar una cuenta nueva")}
          </Link>
        </div>
      </main>
    );
  }

  if (!group || !sessionChecked) {
    return (
      <main className="phone">
        <div className="room-pad room-loading" aria-live="polite">
          {t("Loading the bill…", "Cargando la cuenta…")}
        </div>
      </main>
    );
  }

  if (!me) {
    return (
      <JoinView
        group={group}
        members={members}
        onRecovered={async (s) => {
          adopt(s);
          await refresh();
        }}
        onJoined={async (s) => {
          adopt(s);
          await refresh();
        }}
      />
    );
  }

  const payer = members.find((m) => m.id === group.payer_id);
  const isAdmin = me.is_admin;
  const isPayer = me.id === group.payer_id;
  const check = checkShares(group.total_cents, members);
  const debtors = members.filter((m) => m.id !== group.payer_id && (m.share_cents ?? 0) > 0);
  const confirmedDebtors = debtors.filter((m) => m.confirmed).length;

  return (
    <main className="phone">
      <div className="screen-head room-head">
        <div>
          <h1 className="title">{group.name}</h1>
          <span className="subtitle">
            {formatMoney(group.total_cents, group.currency)} · {t("paid by", "pagó")} {payer?.name ?? "—"}
          </span>
        </div>
        <StatusChip status={group.status} />
      </div>

      <div className="room-pad">
        <YourShare
          group={group}
          me={me}
          isPayer={isPayer}
          payerName={payer?.name ?? ""}
          incomingUsd={members
            .filter((m) => m.id !== group.payer_id)
            .reduce((a, m) => a + (m.settle_usd_cents ?? 0), 0)}
        />

        {actionError && (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        )}

        {group.status === "settled" && <SettledBanner />}

        {group.status === "open" && isAdmin && <InviteCard groupId={group.id} count={members.length} />}

        {WORLD_ON && group.status === "open" && isAdmin && (
          <HumanToggle on={group.require_human} busy={busy !== null} onChange={(on) => act("require-human", { on })} />
        )}

        {WORLD_ON && !me.human_verified && group.status !== "settled" && (
          <section className="world-card">
            <span className="label">{t("REAL PERSON · WORLD ID", "PERSONA REAL · WORLD ID")}</span>
            <p className="wallet-note">
              {group.require_human
                ? WORLD_SELFIE
                  ? t("This table is for verified people. A quick selfie check proves you are a real, unique person — World never shows us your face.", "Esta mesa es solo para personas verificadas. Una selfie rápida prueba que eres una persona real y única — World nunca nos muestra tu cara.")
                  : t("This table is for verified people. Verify with World App that you are a real, unique person — World never tells us who you are.", "Esta mesa es solo para personas verificadas. Verifica con World App que eres una persona real y única — World nunca nos dice quién eres.")
                : WORLD_SELFIE
                  ? t("Optional: prove you are a real person with a quick selfie check. If you ever lose this phone, the same check gets your seat back.", "Opcional: prueba que eres una persona real con una selfie rápida. Si pierdes este teléfono, la misma verificación te devuelve tu lugar.")
                  : t("Optional: prove you are a real person with World App. If you ever lose this phone, verifying again gets your seat back.", "Opcional: prueba con World App que eres una persona real. Si pierdes este teléfono, verificarte de nuevo te devuelve tu lugar.")}
            </p>
            <WorldButton
              groupId={group.id}
              label={t("Verify with World ID", "Verificar con World ID")}
              onProof={async (proof) => {
                if ((await act("verify-human", { proof })) === null) throw new Error("rejected");
              }}
            />
          </section>
        )}

        {group.status === "open" && isAdmin && (
          <SplitControls
            group={group}
            members={members}
            check={check}
            busy={busy}
            onMode={(mode) => act("mode", { mode })}
            onShare={(targetId, cents) => act("set-share", { targetId, cents })}
          />
        )}

        {group.status === "open" && group.split_mode === "own" && (
          <OwnShareInput me={me} busy={busy === "own-share"} currency={group.currency} onSave={(cents) => act("own-share", { cents })} />
        )}

        {group.status === "locked" && (
          <ConfirmProgress done={confirmedDebtors} total={debtors.length} />
        )}

        {group.status !== "open" && <Settlement group={group} />}

        {isPayer && (group.status === "open" || group.payout_evm) && (
          <WalletCard
            group={group}
            onConnect={async (evm) => (await act("payout-wallet", { evm })) !== null}
          />
        )}

        <MemberList
          group={group}
          members={members}
          meId={me.id}
          isAdmin={isAdmin}
          busy={busy}
          onSeat={async (m) => {
            const data = (await act("reissue", { targetId: m.id })) as { memberId?: string; secret?: string } | null;
            if (data?.memberId && data.secret) {
              setSeat({ name: m.name, url: `${window.location.origin}/g/${group.id}#seat=${data.memberId}.${data.secret}` });
            }
          }}
          onRemove={(m) => {
            if (window.confirm(t(`Take ${m.name} off the table?`, `¿Quitar a ${m.name} de la mesa?`))) void act("remove", { targetId: m.id });
          }}
        />

        <SeatSheet seat={seat} onClose={() => setSeat(null)} />

        {group.status === "open" && !isAdmin && (
          <p className="room-note">
            {group.split_mode === "own"
              ? t("Enter what you had above. The admin asks for confirmations once it adds up.", "Escribe arriba lo que consumiste. El admin pide confirmaciones cuando cuadre.")
              : t("The admin is deciding the split. You will be asked to confirm your share.", "El admin está decidiendo el reparto. Te va a pedir que confirmes tu parte.")}
          </p>
        )}

        {group.status === "settled" && group.schedule_id && (
          <a
            className="receipt-link room-receipt"
            href={`https://hashscan.io/testnet/schedule/${encodeURIComponent(group.schedule_id)}`}
            target="_blank"
            rel="noreferrer"
          >
            {t("View the receipt", "Ver el comprobante")}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
            </svg>
          </a>
        )}
      </div>

      <div className="foot">
        {group.status === "open" && isAdmin && (
          <>
            <PressButton
              type="button"
              className="btn btn-settle"
              disabled={!check.balanced || members.length < 2 || busy !== null}
              aria-busy={busy === "lock"}
              onClick={() => act("lock")}
            >
              {busy === "lock" ? (
                <Busy>{t("Converting, buying the plan, putting it on chain…", "Convirtiendo, pagando el cálculo y registrando…")}</Busy>
              ) : (
                t("Ask everyone to confirm", "Pedir que todos confirmen")
              )}
            </PressButton>
            <span className="foot-hint">
              {members.length < 2
                ? t("Show the QR — nobody else has joined yet.", "Enseña el QR — todavía no entra nadie más.")
                : !check.complete
                  ? t("Not every share is decided yet.", "Falta decidir la parte de alguien.")
                  : check.gap !== 0
                    ? check.gap > 0
                      ? t(`${formatMoney(check.gap, group.currency)} still to assign.`, `Faltan ${formatMoney(check.gap, group.currency)} por asignar.`)
                      : t(`${formatMoney(-check.gap, group.currency)} over the bill.`, `Se pasa por ${formatMoney(-check.gap, group.currency)}.`)
                    : group.currency === "USD"
                      ? t("It adds up. Once asked, nobody pays until everyone says yes.", "Ya cuadra. Al pedirlo, nadie paga hasta que todos digan que sí.")
                      : t("It adds up. Asking converts every share to dollars at today's rate — nobody pays until everyone says yes.", "Ya cuadra. Al pedirlo, cada parte se convierte a dólares al tipo de cambio de hoy — nadie paga hasta que todos digan que sí.")}
            </span>
          </>
        )}

        {group.status === "locked" && !isPayer && (me.share_cents ?? 0) > 0 && (
          <PressButton
            type="button"
            className="btn btn-settle"
            disabled={me.confirmed || busy !== null}
            aria-busy={busy === "confirm"}
            onClick={() => act("confirm")}
          >
            {me.confirmed ? (
              t("You confirmed — waiting for the rest", "Ya confirmaste — esperando a los demás")
            ) : busy === "confirm" ? (
              <Busy>{t("Signing…", "Firmando…")}</Busy>
            ) : (
              t(`Yes, I pay ${formatUsd(me.settle_usd_cents ?? 0)}`, `Sí, pago ${formatUsd(me.settle_usd_cents ?? 0)}`)
            )}
          </PressButton>
        )}

        {group.status === "locked" && isAdmin && (
          <PressButton type="button" className="btn btn-ghost" disabled={busy !== null} onClick={() => act("reopen")}>
            {busy === "reopen" ? <Busy>{t("Reopening…", "Reabriendo…")}</Busy> : t("Change the split", "Cambiar el reparto")}
          </PressButton>
        )}

        {group.status === "settled" && (
          <PressLink href="/nuevo" className="btn btn-dark">
            {t("Split another bill", "Dividir otra cuenta")}
          </PressLink>
        )}
      </div>
    </main>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────

/** A spinner inside a button, so a slow chain call never looks like a dead tap. */
function Busy({ children }: { children: React.ReactNode }) {
  return (
    <span className="busy">
      <span className="spinner" aria-hidden="true" />
      {children}
    </span>
  );
}

/** 0.0.X@SECONDS.NANOS  ->  0.0.X-SECONDS-NANOS, the form the explorer takes. */
function txPath(id: string) {
  const [account, stamp = ""] = id.split("@");
  return `${account}-${stamp.replace(".", "-")}`;
}

/**
 * What is settling, and in what: the frozen exchange rate, the dollar token,
 * and the x402 payment that bought the plan. Each line opens on the chain or
 * names its source, so none of it is a claim on a screen.
 */
function Settlement({ group }: { group: Group }) {
  const { t } = useLocale();
  const rate = group.fx_usd_per_unit;
  const converted = rate !== null && group.currency !== "USD";
  return (
    <section className="settle-card" aria-label={t("How it settles", "Cómo se liquida")}>
      <span className="label">{t("SETTLES IN DOLLARS", "SE LIQUIDA EN DÓLARES")}</span>
      {converted && (
        <div className="settle-line">
          <span className="grow">{t("Rate, frozen for this bill", "Tipo de cambio, fijo para esta cuenta")}</span>
          <span className="money">1 {group.currency} = {Number(rate).toFixed(6)} USD</span>
        </div>
      )}
      {converted && (
        <div className="settle-sub">
          {group.fx_source} · {group.fx_as_of}
        </div>
      )}
      {group.payout_account && (
        <div className="settle-line">
          <span className="grow">{t("Paid into the payer's own wallet", "Se paga a la cartera propia de quien pagó")}</span>
          <a className="money receipt-link" href={`https://hashscan.io/testnet/account/${group.payout_account}`} target="_blank" rel="noreferrer">
            {group.payout_account} ↗
          </a>
        </div>
      )}
      {group.settle_token && (
        <a
          className="settle-line settle-link"
          href={`https://hashscan.io/testnet/token/${encodeURIComponent(group.settle_token)}`}
          target="_blank"
          rel="noreferrer"
        >
          <span className="grow">{t("Moves as tUSD, a Hedera dollar token", "Se mueve como tUSD, un token de dólares en Hedera")}</span>
          <span aria-hidden="true">↗</span>
        </a>
      )}
      {group.plan_receipt && (
        <a
          className="receipt plan-receipt"
          href={`https://hashscan.io/testnet/transaction/${encodeURIComponent(txPath(group.plan_receipt))}`}
          target="_blank"
          rel="noreferrer"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
          <span className="grow">
            {t("Plan bought from the engine · paid over x402", "Cálculo comprado al motor · pagado por x402")}
          </span>
          <span aria-hidden="true">↗</span>
        </a>
      )}
    </section>
  );
}

/**
 * The payer's wallet: opt-in, below everything else, and it loads Privy only
 * when opened — so it can never stand between anyone and the bill.
 */
function WalletCard({ group, onConnect }: { group: Group; onConnect: (evm: string) => Promise<boolean> }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(!!group.payout_evm);
  return (
    <section className="wallet-card" aria-label={t("Where you get paid", "Dónde recibes tu dinero")}>
      <div className="wallet-head">
        <span className="label">{t("WHERE YOU GET PAID", "DÓNDE RECIBES TU DINERO")}</span>
        <span className="wallet-by">Privy</span>
      </div>
      {open ? (
        <PayoutWallet
          status={group.status}
          payoutEvm={group.payout_evm}
          payoutAccount={group.payout_account}
          onConnect={onConnect}
        />
      ) : (
        <>
          <p className="wallet-note">
            {t(
              "By default the money you are owed goes to the table's test account. You can have it land in your own wallet instead — made from your email in seconds.",
              "Por defecto lo que te deben llega a la cuenta de prueba de la mesa. Puedes hacer que llegue a tu propia cartera — se crea con tu correo en segundos.",
            )}
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
            {t("Use my own wallet", "Usar mi propia cartera")}
          </button>
        </>
      )}
    </section>
  );
}

/** The moment it all went through. A check that draws itself, once. */
function SettledBanner() {
  const { t } = useLocale();
  return (
    <section className="settled-banner" role="status">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* CSS, not JS: the finished check is the resting state, so a
            throttled frame loop can never leave it half drawn. */}
        <path className="draw-check" d="M4 12.5l5 5L20 6.5" />
      </svg>
      <div>
        <strong>{t("Paid. Everyone is at zero.", "Pagado. Todos quedaron en cero.")}</strong>
        <span>{t("Every transfer went through at once, in one transaction.", "Todas las transferencias salieron juntas, en una sola transacción.")}</span>
      </div>
    </section>
  );
}

function StatusChip({ status }: { status: Group["status"] }) {
  const { t } = useLocale();
  const label =
    status === "open"
      ? t("Splitting", "Repartiendo")
      : status === "locked"
        ? t("Confirming", "Confirmando")
        : t("Settled", "Liquidada");
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={status}
        className={`status-chip status-${status}`}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {label}
      </motion.span>
    </AnimatePresence>
  );
}

function YourShare({
  group,
  me,
  isPayer,
  payerName,
  incomingUsd,
}: {
  group: Group;
  me: Member;
  isPayer: boolean;
  payerName: string;
  incomingUsd: number;
}) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const live = useUsdRate(group.status === "open" && group.currency !== "USD" ? group.currency : null);
  const share = me.share_cents;
  const frozen = group.status !== "open";
  const owedToMe = group.total_cents - (share ?? 0);

  let caption: string;
  if (group.status === "settled") {
    caption = isPayer
      ? t("Settled. Everyone paid you.", "Liquidada. Todos te pagaron.")
      : t(`Settled. You paid ${payerName}.`, `Liquidada. Le pagaste a ${payerName}.`);
  } else if (isPayer) {
    caption = t(
      `You paid. The others owe you ${formatMoney(owedToMe, group.currency)}.`,
      `Tú pagaste. Los demás te deben ${formatMoney(owedToMe, group.currency)}.`,
    );
  } else if (share === null) {
    caption = t("Your share is not decided yet.", "Todavía no se decide tu parte.");
  } else {
    caption = t(`You owe ${payerName}.`, `Le debes a ${payerName}.`);
  }

  // What this person will actually pay in dollars: frozen once confirmations
  // start, an estimate at today's rate before that.
  let dollars: string | null = null;
  if (isPayer && frozen && incomingUsd > 0) {
    dollars = t(`You receive ${formatUsd(incomingUsd)} in dollars`, `Recibes ${formatUsd(incomingUsd)} en dólares`);
  } else if (!isPayer && share !== null && share > 0) {
    if (frozen && me.settle_usd_cents !== null) {
      dollars = t(`You pay ${formatUsd(me.settle_usd_cents)} in dollars`, `Pagas ${formatUsd(me.settle_usd_cents)} en dólares`);
    } else if (group.currency !== "USD" && live) {
      dollars = t(
        `≈ ${formatUsd(Math.round(share * live.usdPerUnit))} at today's rate`,
        `≈ ${formatUsd(Math.round(share * live.usdPerUnit))} al tipo de cambio de hoy`,
      );
    }
  }

  const amount = share === null ? "—" : formatCents(share);

  return (
    <section className="your-share" aria-live="polite">
      <span className="label">
        {t("YOU ARE", "ERES")} {me.name.toUpperCase()}
        {me.is_admin ? ` · ${t("ADMIN", "ADMIN")}` : ""}
      </span>
      <span className="your-amount-row">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={amount}
            className={`your-amount ${isPayer ? "is-payer" : ""}`}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -14, transition: { duration: 0.14 } }}
            transition={SPRING}
          >
            {amount}
          </motion.span>
        </AnimatePresence>
        <span className="your-currency">{group.currency}</span>
      </span>
      {dollars && <span className={frozen ? "your-usd frozen" : "your-usd"}>{dollars}</span>}
      <span className="your-caption">{caption}</span>
    </section>
  );
}

function InviteCard({ groupId, count }: { groupId: string; count: number }) {
  const { t } = useLocale();
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const link = `${window.location.origin}/g/${groupId}`;
    setUrl(link);
    // A real QR of the real link — scan it and you land in this group.
    QRCode.toDataURL(link, {
      margin: 1,
      width: 360,
      errorCorrectionLevel: "M",
      color: { dark: "#1b2430", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [groupId]);

  return (
    <section className="invite-card">
      <div className="invite-qr">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated data URL
          <img src={qr} alt={t(`QR code linking to this bill: ${url}`, `Código QR con el enlace a esta cuenta: ${url}`)} width={148} height={148} />
        ) : (
          <span className="invite-qr-empty">{t("Making the QR…", "Generando el QR…")}</span>
        )}
      </div>
      <div className="invite-text">
        <strong>{t("Show this at the table", "Enséñalo en la mesa")}</strong>
        <span>
          {t(
            `Each person scans it and joins. ${count} at the table so far.`,
            `Cada quien lo escanea y entra. Van ${count} en la mesa.`,
          )}
        </span>
        <button
          type="button"
          className="link-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? t("Link copied", "Enlace copiado") : t("Copy the link instead", "Mejor copiar el enlace")}
        </button>
        <span className="invite-tip">
          {t(
            "Trying it alone? Open the link in a private window — this browser is already you.",
            "¿Lo pruebas tú solo? Abre el enlace en una ventana de incógnito — este navegador ya eres tú.",
          )}
        </span>
      </div>
    </section>
  );
}

function SplitControls({
  group,
  members,
  check,
  busy,
  onMode,
  onShare,
}: {
  group: Group;
  members: Member[];
  check: ReturnType<typeof checkShares>;
  busy: string | null;
  onMode: (mode: SplitMode) => void;
  onShare: (targetId: string, cents: number) => void;
}) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const modes: Array<{ id: SplitMode; label: string; hint: string }> = [
    { id: "equal", label: t("Equal parts", "Partes iguales"), hint: t("Same for everyone", "Igual para todos") },
    { id: "custom", label: t("I set amounts", "Yo pongo montos"), hint: t("You decide each share", "Tú decides cada parte") },
    { id: "own", label: t("Each their own", "Cada quien lo suyo"), hint: t("Everyone enters theirs", "Cada uno escribe lo suyo") },
  ];

  return (
    <section className="split-controls">
      <span className="label">{t("HOW TO SPLIT IT", "CÓMO SE DIVIDE")}</span>
      <div className="mode-picker" role="radiogroup" aria-label={t("Split mode", "Modo de reparto")}>
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={group.split_mode === m.id}
            className={group.split_mode === m.id ? "mode on" : "mode"}
            disabled={busy !== null}
            onClick={() => group.split_mode !== m.id && onMode(m.id)}
          >
            {group.split_mode === m.id && (
              <motion.span layoutId="mode-pill" className="mode-pill" transition={reduce ? { duration: 0 } : SPRING} />
            )}
            <span className="mode-label">{m.label}</span>
            <span className="mode-hint">{m.hint}</span>
          </button>
        ))}
      </div>

      {group.split_mode === "custom" && (
        <div className="card custom-shares">
          {members.map((m) => (
            <CustomShareRow key={m.id} member={m} disabled={busy !== null} onSave={(c) => onShare(m.id, c)} />
          ))}
          <div className={`share-balance ${check.balanced ? "ok" : ""}`}>
            <span>{t("Assigned", "Asignado")}</span>
            <span className="money">
              {formatCents(check.assigned)} / {formatMoney(group.total_cents, group.currency)}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function CustomShareRow({
  member,
  disabled,
  onSave,
}: {
  member: Member;
  disabled: boolean;
  onSave: (cents: number) => void;
}) {
  const { t } = useLocale();
  const server = member.share_cents === null ? "" : (member.share_cents / 100).toFixed(2);
  const [draft, setDraft] = useState(server);
  const [editing, setEditing] = useState(false);

  // Follow the server unless this row is being typed in.
  useEffect(() => {
    if (!editing) setDraft(server);
  }, [server, editing]);

  const commit = () => {
    setEditing(false);
    const cents = parseMoney(draft);
    if (cents !== null && cents !== member.share_cents) onSave(cents);
    else setDraft(server);
  };

  return (
    <label className="row custom-row">
      <span className="grow">{member.name}</span>
      <span className="money-input compact">
        <span aria-hidden="true">$</span>
        <input
          value={draft}
          inputMode="decimal"
          disabled={disabled}
          aria-label={t(`Share for ${member.name}`, `Parte de ${member.name}`)}
          onFocus={() => setEditing(true)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder="0.00"
        />
      </span>
    </label>
  );
}

function OwnShareInput({
  me,
  busy,
  currency,
  onSave,
}: {
  me: Member;
  busy: boolean;
  currency: Currency;
  onSave: (cents: number) => void;
}) {
  const { t } = useLocale();
  const [draft, setDraft] = useState(me.share_cents === null ? "" : (me.share_cents / 100).toFixed(2));
  const cents = parseMoney(draft);

  return (
    <form
      className="own-share"
      onSubmit={(e) => {
        e.preventDefault();
        if (cents !== null) onSave(cents);
      }}
    >
      <span className="label">{t("WHAT YOU HAD", "LO QUE CONSUMISTE")}</span>
      <div className="own-share-row">
        <span className="money-input">
          <span aria-hidden="true">$</span>
          <input
            value={draft}
            inputMode="decimal"
            onChange={(e) => setDraft(e.target.value)}
            placeholder="0.00"
            aria-label={t("What you had", "Lo que consumiste")}
          />
          <span className="money-unit">{currency}</span>
        </span>
        <PressButton type="submit" className="btn btn-dark btn-inline" disabled={cents === null || busy}>
          {busy ? t("Saving…", "Guardando…") : t("Save", "Guardar")}
        </PressButton>
      </div>
    </form>
  );
}

function ConfirmProgress({ done, total }: { done: number; total: number }) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  return (
    <section className="confirm-progress" aria-live="polite">
      <div className="confirm-count">
        <span className="headline-count" style={{ fontSize: 38 }}>
          {done}
        </span>
        <span>
          {t(`of ${total} confirmed`, `de ${total} confirmaron`)}
        </span>
      </div>
      <div className="confirm-bar" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i}>
            <motion.i
              initial={false}
              animate={{ scaleX: i < done ? 1 : 0 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }}
            />
          </span>
        ))}
      </div>
      <p className="room-note">
        {t(
          "All payments are one transaction waiting on chain. It executes the moment the last person says yes — and not a second before.",
          "Todos los pagos son una sola transacción esperando en la cadena. Se ejecuta en cuanto el último dice que sí — ni un segundo antes.",
        )}
      </p>
    </section>
  );
}

function MemberList({
  group,
  members,
  meId,
  isAdmin,
  busy,
  onSeat,
  onRemove,
}: {
  group: Group;
  members: Member[];
  meId: string;
  isAdmin: boolean;
  busy: string | null;
  onSeat: (m: Member) => void;
  onRemove: (m: Member) => void;
}) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const frozen = group.status !== "open";
  return (
    <section>
      <span className="label">
        {t("AT THE TABLE", "EN LA MESA")} · {members.length}
      </span>
      <ul className="card member-list">
        <AnimatePresence initial={false}>
        {members.map((m) => {
          const isPayer = m.id === group.payer_id;
          const owes = !isPayer && (m.share_cents ?? 0) > 0;
          return (
            <motion.li
              key={m.id}
              className="row"
              layout={reduce ? false : "position"}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={SPRING}
            >
              <span className={m.id === meId ? "avatar you" : "avatar"} aria-hidden="true">
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="grow member-meta">
                <span className="member-name">
                  {m.name}
                  {m.id === meId ? ` (${t("you", "tú")})` : ""}
                  {m.human_verified && (
                    <span className="human-badge" title={t("Verified real person (World ID)", "Persona real verificada (World ID)")}>
                      ✓ {t("verified", "verificado")}
                    </span>
                  )}
                </span>
                <span className="member-role">
                  {isPayer
                    ? t("Paid the bill", "Pagó la cuenta")
                    : group.status === "locked"
                      ? m.confirmed
                        ? t("Confirmed", "Confirmó")
                        : t("Waiting for them", "Falta que confirme")
                      : group.status === "settled"
                        ? t("Paid", "Pagó")
                        : m.share_cents === null
                          ? t("Share not set", "Sin parte asignada")
                          : t("Owes", "Debe")}
                </span>
              </span>
              <span className="member-money">
                <span className="money">{m.share_cents === null ? "—" : formatCents(m.share_cents)}</span>
                {frozen && !isPayer && m.settle_usd_cents !== null && m.settle_usd_cents > 0 && (
                  <span className="money-usd">{formatUsd(m.settle_usd_cents)}</span>
                )}
              </span>
              {group.status === "locked" && owes && (
                <span className={m.confirmed ? "tick on" : "tick"} aria-label={m.confirmed ? t("confirmed", "confirmó") : t("pending", "pendiente")}>
                  {m.confirmed ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path className="draw-check" d="M4 12.5l5 5L20 6.5" />
                    </svg>
                  ) : null}
                </span>
              )}
              {isAdmin && !m.is_admin && group.status !== "settled" && !(group.status === "locked" && m.confirmed) && (
                <span className="member-tools">
                  <button
                    type="button"
                    className="tool-button"
                    disabled={busy !== null}
                    onClick={() => onSeat(m)}
                    title={t(`Send ${m.name} their seat`, `Mandarle su lugar a ${m.name}`)}
                    aria-label={t(`Send ${m.name} their seat — if they changed phone or browser`, `Mandarle su lugar a ${m.name} — si cambió de teléfono o navegador`)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z" />
                    </svg>
                  </button>
                  {group.status === "open" && (
                    <button
                      type="button"
                      className="tool-button danger"
                      disabled={busy !== null}
                      onClick={() => onRemove(m)}
                      title={t(`Take ${m.name} off the table`, `Quitar a ${m.name} de la mesa`)}
                      aria-label={t(`Take ${m.name} off the table`, `Quitar a ${m.name} de la mesa`)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  )}
                </span>
              )}
            </motion.li>
          );
        })}
        </AnimatePresence>
      </ul>
      {isAdmin && group.status !== "settled" && members.length > 1 && (
        <p className="member-help">
          {t(
            "Someone lost their seat (new phone, other browser)? Tap the QR next to their name and let them scan it.",
            "¿Alguien perdió su lugar (otro teléfono u otro navegador)? Toca el QR junto a su nombre y que lo escanee.",
          )}
        </p>
      )}
    </section>
  );
}

/** "Verified people only": one live human per seat, one seat per human. */
function HumanToggle({ on, busy, onChange }: { on: boolean; busy: boolean; onChange: (on: boolean) => void }) {
  const { t } = useLocale();
  return (
    <label className="human-toggle">
      <span className="grow">
        <strong>{t("Verified people only", "Solo personas verificadas")}</strong>
        <small>
          {WORLD_SELFIE
            ? t(
                "Everyone passes World ID Selfie Check to take a seat — no fake guests, no one person holding two seats.",
                "Cada quien pasa Selfie Check de World ID para entrar — sin invitados falsos ni una persona con dos lugares.",
              )
            : t(
                "Everyone verifies with World ID to take a seat — no fake guests, no one person holding two seats.",
                "Cada quien se verifica con World ID para entrar — sin invitados falsos ni una persona con dos lugares.",
              )}
        </small>
      </span>
      <input type="checkbox" role="switch" checked={on} disabled={busy} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** A seat handed back: the QR and link that make someone themselves again. */
function SeatSheet({ seat, onClose }: { seat: { name: string; url: string } | null; onClose: () => void }) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setQr(null);
    setCopied(false);
    if (!seat) return;
    QRCode.toDataURL(seat.url, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#1b2430", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seat, onClose]);

  return (
    <AnimatePresence>
      {seat && (
        <motion.div
          className="sheet-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="seat-title"
            initial={reduce ? false : { opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.14 } }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="label">{t("SEAT", "LUGAR")}</span>
            <h2 id="seat-title" className="sheet-title">
              {t(`${seat.name}, scan this`, `${seat.name}, escanea esto`)}
            </h2>
            <div className="sheet-qr">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element -- generated data URL
                <img src={qr} alt={t(`QR that gives ${seat.name} their seat back`, `QR que le devuelve su lugar a ${seat.name}`)} width={220} height={220} />
              ) : (
                <span className="invite-qr-empty">{t("Making the QR…", "Generando el QR…")}</span>
              )}
            </div>
            <p className="sheet-note">
              {t(
                "It opens this bill as them, on any phone. Their old link stops working. Only show it to them.",
                "Abre esta cuenta como esa persona, en cualquier teléfono. Su enlace anterior deja de servir. Enséñaselo solo a ella.",
              )}
            </p>
            <div className="sheet-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(seat.url);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? t("Link copied", "Enlace copiado") : t("Copy the link", "Copiar el enlace")}
              </button>
              <button type="button" className="btn btn-dark" onClick={onClose} autoFocus>
                {t("Done", "Listo")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function JoinView({
  group,
  members,
  onJoined,
  onRecovered,
}: {
  group: Group;
  members: Member[];
  onJoined: (s: GroupSession) => Promise<void> | void;
  onRecovered: (s: GroupSession) => Promise<void> | void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payer = members.find((m) => m.id === group.payer_id);
  const closed = group.status !== "open";

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (group.require_human) return; // the World button joins, with its proof
    await joinWith();
  }

  async function joinWith(proof?: unknown) {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithin(
        `/api/groups/${group.id}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "join", name, proof }),
        },
        45_000,
      );
      const data = (await res.json()) as { memberId?: string; secret?: string; error?: string };
      if (!res.ok || !data.memberId || !data.secret) throw new Error(data.error ?? `Error ${res.status}`);
      await onJoined({ memberId: data.memberId, secret: data.secret });
    } catch (err) {
      setError(explain(err, t));
      setBusy(false);
    }
  }

  return (
    <main className="phone">
      <form onSubmit={join} className="join-view">
        <LogoMark size={64} className="join-mark" />
        <span className="label">
          {payer ? t(`${payer.name.toUpperCase()} INVITED YOU`, `${payer.name.toUpperCase()} TE INVITÓ`) : ""}
        </span>
        <h1 className="join-title">{group.name}</h1>
        <p className="join-sub">
          {formatMoney(group.total_cents, group.currency)} · {members.length} {t("at the table", "en la mesa")}
        </p>

        {closed ? (
          <p className="form-error" role="alert">
            {group.status === "settled"
              ? t("This bill is already settled.", "Esta cuenta ya se liquidó.")
              : t("Confirmations have started, so nobody new can join.", "Ya empezaron las confirmaciones, así que ya no puede entrar nadie nuevo.")}
          </p>
        ) : null}

        {closed ? (
          group.status === "locked" && (
            <p className="join-foot">
              {t(
                "Already at this table from another phone or browser? Ask the admin to tap the QR next to your name — scanning it gives you your seat back.",
                "¿Ya estabas en esta mesa desde otro teléfono o navegador? Pide al admin que toque el QR junto a tu nombre — al escanearlo recuperas tu lugar.",
              )}
            </p>
          )
        ) : (
          <>
            <label className="field">
              <span className="label">{t("YOUR NAME", "TU NOMBRE")}</span>
              <input
                className="text-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoComplete="given-name"
                aria-label={t("Your name", "Tu nombre")}
                autoFocus
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {group.require_human ? (
              WORLD_ON && (
                <WorldButton
                  groupId={group.id}
                  className="btn btn-dark"
                  disabled={!name.trim() || busy}
                  label={t("Verify with World ID and join", "Verificar con World ID y entrar")}
                  onProof={async (proof) => {
                    await joinWith(proof);
                  }}
                />
              )
            ) : (
              <PressButton type="submit" className="btn btn-dark" disabled={!name.trim() || busy}>
                {busy ? <Busy>{t("Joining…", "Entrando…")}</Busy> : t("Join the table", "Entrar a la mesa")}
              </PressButton>
            )}
            <p className="join-foot">
              {t(
                "You will see your share and confirm it. Nobody pays until everyone agrees.",
                "Vas a ver tu parte y confirmarla. Nadie paga hasta que todos estén de acuerdo.",
              )}
            </p>
          </>
        )}
        {WORLD_ON && group.status !== "settled" && (
          <div className="world-recover">
            <span className="join-foot">
              {t("Already had a seat and verified it with World?", "¿Ya tenías lugar y lo verificaste con World?")}
            </span>
            <WorldButton
              groupId={group.id}
              label={t("Get my seat back with World ID", "Recuperar mi lugar con World ID")}
              onProof={async (proof) => {
                const res = await fetchWithin(
                  `/api/groups/${group.id}`,
                  { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "recover-human", proof }) },
                  30_000,
                );
                const data = (await res.json()) as { memberId?: string; secret?: string; error?: string };
                if (!res.ok || !data.memberId || !data.secret) {
                  setError(data.error ?? `Error ${res.status}`);
                  throw new Error(data.error ?? "rejected");
                }
                await onRecovered({ memberId: data.memberId, secret: data.secret });
              }}
            />
          </div>
        )}
      </form>
    </main>
  );
}
