"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/Locale";
import { clearSession, loadSession, saveSession, type GroupSession } from "@/lib/groupSession";
import { formatCents } from "@/lib/netting";
import { checkShares, parseMoney, type SplitMode } from "@/lib/split";
import { browserClient, supabaseConfigured } from "@/lib/supabase";

interface Group {
  id: string;
  name: string;
  total_cents: number;
  payer_id: string;
  split_mode: SplitMode;
  status: "open" | "locked" | "settled";
  schedule_id: string | null;
  plan_receipt: string | null;
}

interface Member {
  id: string;
  name: string;
  is_admin: boolean;
  share_cents: number | null;
  confirmed: boolean;
  account_index: number;
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
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${id}`, { cache: "no-store" });
      const data = (await res.json()) as { group?: Group; members?: Member[]; error?: string };
      if (!res.ok || !data.group) throw new Error(data.error ?? `Error ${res.status}`);
      setGroup(data.group);
      setMembers(data.members ?? []);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    setSession(loadSession(id));
    setSessionChecked(true);
    void refresh();
  }, [id, refresh]);

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
        const res = await fetch(`/api/groups/${id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...session, ...extra }),
        });
        const data = (await res.json()) as Record<string, unknown> & { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
        await refresh();
        return data;
      } catch (e) {
        setActionError((e as Error).message);
        return null;
      } finally {
        setBusy(null);
      }
    },
    [id, session, refresh],
  );

  const me = useMemo(() => members.find((m) => m.id === session?.memberId) ?? null, [members, session]);

  // A saved session for a member who is no longer here is stale; drop it so
  // the join form shows instead of a broken view.
  useEffect(() => {
    if (session && group && members.length > 0 && !me) {
      clearSession(id);
      setSession(null);
    }
  }, [session, group, members, me, id]);

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
        onJoined={(s) => {
          saveSession(id, s);
          setSession(s);
          void refresh();
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
            {formatCents(group.total_cents)} · {t("paid by", "pagó")} {payer?.name ?? "—"}
          </span>
        </div>
        <StatusChip status={group.status} />
      </div>

      <div className="room-pad">
        <YourShare group={group} me={me} isPayer={isPayer} payerName={payer?.name ?? ""} />

        {actionError && (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        )}

        {group.status === "open" && isAdmin && <InviteCard groupId={group.id} count={members.length} />}

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
          <OwnShareInput me={me} busy={busy === "own-share"} onSave={(cents) => act("own-share", { cents })} />
        )}

        {group.status === "locked" && (
          <ConfirmProgress done={confirmedDebtors} total={debtors.length} />
        )}

        {group.status !== "open" && <PlanReceipt receipt={group.plan_receipt} />}

        <MemberList group={group} members={members} meId={me.id} />

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
            <button
              type="button"
              className="btn btn-settle"
              disabled={!check.balanced || members.length < 2 || busy !== null}
              onClick={() => act("lock")}
            >
              {busy === "lock"
                ? t("Buying the plan and putting it on chain…", "Pagando el cálculo y registrando…")
                : t("Ask everyone to confirm", "Pedir que todos confirmen")}
            </button>
            <span className="foot-hint">
              {members.length < 2
                ? t("Show the QR — nobody else has joined yet.", "Enseña el QR — todavía no entra nadie más.")
                : !check.complete
                  ? t("Not every share is decided yet.", "Falta decidir la parte de alguien.")
                  : check.gap !== 0
                    ? check.gap > 0
                      ? t(`${formatCents(check.gap)} still to assign.`, `Faltan ${formatCents(check.gap)} por asignar.`)
                      : t(`${formatCents(-check.gap)} over the bill.`, `Se pasa por ${formatCents(-check.gap)}.`)
                    : t("It adds up. Once asked, nobody pays until everyone says yes.", "Ya cuadra. Al pedirlo, nadie paga hasta que todos digan que sí.")}
            </span>
          </>
        )}

        {group.status === "locked" && !isPayer && (me.share_cents ?? 0) > 0 && (
          <button
            type="button"
            className="btn btn-settle"
            disabled={me.confirmed || busy !== null}
            onClick={() => act("confirm")}
          >
            {me.confirmed
              ? t("You confirmed — waiting for the rest", "Ya confirmaste — esperando a los demás")
              : busy === "confirm"
                ? t("Signing…", "Firmando…")
                : t(`Yes, I pay ${formatCents(me.share_cents ?? 0)}`, `Sí, pago ${formatCents(me.share_cents ?? 0)}`)}
          </button>
        )}

        {group.status === "locked" && isAdmin && (
          <button type="button" className="btn btn-ghost" disabled={busy !== null} onClick={() => act("reopen")}>
            {busy === "reopen" ? t("Reopening…", "Reabriendo…") : t("Change the split", "Cambiar el reparto")}
          </button>
        )}

        {group.status === "settled" && (
          <Link href="/nuevo" className="btn btn-dark">
            {t("Split another bill", "Dividir otra cuenta")}
          </Link>
        )}
      </div>
    </main>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────

/**
 * The app bought this settlement plan from the metered engine over x402.
 * Shown with the transaction that paid for it, so the charge is something a
 * person can open and check rather than a claim on a screen.
 */
function PlanReceipt({ receipt }: { receipt: string | null }) {
  const { t } = useLocale();
  if (!receipt) return null;

  // 0.0.X@SECONDS.NANOS  ->  0.0.X-SECONDS-NANOS, the form the explorer takes
  const [account, stamp = ""] = receipt.split("@");
  const txPath = `${account}-${stamp.replace(".", "-")}`;

  return (
    <a
      className="receipt plan-receipt"
      href={`https://hashscan.io/testnet/transaction/${encodeURIComponent(txPath)}`}
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
  return <span className={`status-chip status-${status}`}>{label}</span>;
}

function YourShare({
  group,
  me,
  isPayer,
  payerName,
}: {
  group: Group;
  me: Member;
  isPayer: boolean;
  payerName: string;
}) {
  const { t } = useLocale();
  const share = me.share_cents;

  let caption: string;
  if (group.status === "settled") {
    caption = t("Settled. Everyone is at zero.", "Liquidada. Todos en cero.");
  } else if (isPayer) {
    const owed = group.total_cents - (share ?? 0);
    caption = t(`You paid. The others owe you ${formatCents(owed)}.`, `Tú pagaste. Los demás te deben ${formatCents(owed)}.`);
  } else if (share === null) {
    caption = t("Your share is not decided yet.", "Todavía no se decide tu parte.");
  } else {
    caption = t(`You owe ${payerName}.`, `Le debes a ${payerName}.`);
  }

  return (
    <section className="your-share" aria-live="polite">
      <span className="label">
        {t("YOU ARE", "ERES")} {me.name.toUpperCase()}
        {me.is_admin ? ` · ${t("ADMIN", "ADMIN")}` : ""}
      </span>
      <span className={`your-amount ${isPayer ? "is-payer" : ""}`}>
        {share === null ? "—" : formatCents(share)}
      </span>
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
      color: { dark: "#171b17", light: "#f8f9f6" },
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
              {formatCents(check.assigned)} / {formatCents(group.total_cents)}
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

function OwnShareInput({ me, busy, onSave }: { me: Member; busy: boolean; onSave: (cents: number) => void }) {
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
        </span>
        <button type="submit" className="btn btn-dark btn-inline" disabled={cents === null || busy}>
          {busy ? t("Saving…", "Guardando…") : t("Save", "Guardar")}
        </button>
      </div>
    </form>
  );
}

function ConfirmProgress({ done, total }: { done: number; total: number }) {
  const { t } = useLocale();
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
          <span key={i} className={i < done ? "on" : ""} />
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

function MemberList({ group, members, meId }: { group: Group; members: Member[]; meId: string }) {
  const { t } = useLocale();
  return (
    <section>
      <span className="label">
        {t("AT THE TABLE", "EN LA MESA")} · {members.length}
      </span>
      <ul className="card member-list">
        {members.map((m) => {
          const isPayer = m.id === group.payer_id;
          const owes = !isPayer && (m.share_cents ?? 0) > 0;
          return (
            <li key={m.id} className="row">
              <span className={m.id === meId ? "avatar you" : "avatar"} aria-hidden="true">
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="grow member-meta">
                <span className="member-name">
                  {m.name}
                  {m.id === meId ? ` (${t("you", "tú")})` : ""}
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
              <span className="money">{m.share_cents === null ? "—" : formatCents(m.share_cents)}</span>
              {group.status === "locked" && owes && (
                <span className={m.confirmed ? "tick on" : "tick"} aria-label={m.confirmed ? t("confirmed", "confirmó") : t("pending", "pendiente")}>
                  {m.confirmed ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 12.5l5 5L20 6.5" />
                    </svg>
                  ) : null}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function JoinView({
  group,
  members,
  onJoined,
}: {
  group: Group;
  members: Member[];
  onJoined: (s: GroupSession) => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payer = members.find((m) => m.id === group.payer_id);
  const closed = group.status !== "open";

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "join", name }),
      });
      const data = (await res.json()) as { memberId?: string; secret?: string; error?: string };
      if (!res.ok || !data.memberId || !data.secret) throw new Error(data.error ?? `Error ${res.status}`);
      onJoined({ memberId: data.memberId, secret: data.secret });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="phone">
      <form onSubmit={join} className="join-view">
        <span className="label">
          {payer ? t(`${payer.name.toUpperCase()} INVITED YOU`, `${payer.name.toUpperCase()} TE INVITÓ`) : ""}
        </span>
        <h1 className="join-title">{group.name}</h1>
        <p className="join-sub">
          {formatCents(group.total_cents)} · {members.length} {t("at the table", "en la mesa")}
        </p>

        {closed ? (
          <p className="form-error" role="alert">
            {group.status === "settled"
              ? t("This bill is already settled.", "Esta cuenta ya se liquidó.")
              : t("Confirmations have started — ask the admin to reopen it to join.", "Ya empezaron las confirmaciones — pide al admin que la reabra para entrar.")}
          </p>
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
                autoFocus
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-settle" disabled={!name.trim() || busy}>
              {busy ? t("Joining…", "Entrando…") : t("Join the table", "Entrar a la mesa")}
            </button>
            <p className="join-foot">
              {t(
                "You will see your share and confirm it. Nobody pays until everyone agrees.",
                "Vas a ver tu parte y confirmarla. Nadie paga hasta que todos estén de acuerdo.",
              )}
            </p>
          </>
        )}
      </form>
    </main>
  );
}
