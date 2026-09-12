"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { PayingNotice } from "@/components/PayingNotice";
import { useGroup } from "@/components/GroupProvider";
import { formatCents, type Transfer } from "@/lib/netting";
import { useLocale } from "@/components/Locale";
import { usePrivy, useWallets } from "@privy-io/react-auth";

/**
 * Waiting for signatures.
 *
 * The whole plan is ONE scheduled transaction on Hedera: every debit and every
 * credit in a single transfer list, sitting pending until each debited account
 * has signed. The last signature makes it execute as a unit.
 *
 * So "nobody pays until everybody confirms" is not the app being polite. The
 * transaction cannot go through until it is complete — and the screen below is
 * watching real signatures land, not a timer.
 *
 * Only parties whose money moves have to sign. The receivers do not.
 */
export default function SignScreen() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { people } = useGroup();

  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<Transfer[] | null>(null);
  const [signed, setSigned] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const { user, ready: privyReady, authenticated } = usePrivy();
  const { wallets } = useWallets();

  const wallet =
    wallets.find(
      (candidate: any) =>
        candidate?.address?.toLowerCase() === user?.wallet?.address?.toLowerCase(),
    ) ?? wallets[0] ?? null;

  const walletPublicKey = (user as any)?.wallet?.publicKey ?? (wallet as any)?.publicKey ?? null;
  const personNameFor = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const personInitialFor = (id: string) => people.find((p) => p.id === id)?.initial ?? id[0]?.toUpperCase() ?? "?";

  const hasRealWallet = Boolean(wallet && walletPublicKey);
  const walletStateMessage = !authenticated
    ? t("Sign in with Privy to confirm your part.", "Inicia sesión con Privy para confirmar tu parte.")
    : !hasRealWallet
      ? t("This session does not expose a Privy wallet yet. Connect or create one to sign the schedule.", "Esta sesión todavía no expone una wallet de Privy. Conecta o crea una para firmar el schedule.")
      : null;
  
  const sign = useCallback(async (id: string, person: string) => {
    if (!privyReady) {
      throw new Error("Privy is still loading. Please wait a moment and try again.");
    }

    if (!authenticated) {
      throw new Error("Please sign in with Privy before confirming your part.");
    }

    if (!wallet || !walletPublicKey) {
      throw new Error("This session does not expose a Privy wallet yet. Connect or create one and try again.");
    }

    const prepareRes = await fetch("/api/settle/sign/prepare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scheduleId: id }),
    });

    if (!prepareRes.ok) {
      throw new Error("Failed to prepare transaction");
    }

    const { bytes } = (await prepareRes.json()) as { bytes: number[] };

    const hex = `0x${Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}`;

    const signatureHex = await wallet.sign(hex);

    const submitRes = await fetch("/api/settle/sign/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scheduleId: id,
        bytes: btoa(String.fromCharCode(...bytes)),
        signature: signatureHex,
        publicKey: walletPublicKey,
      }),
    });

    if (!submitRes.ok) {
      throw new Error("Failed to submit transaction");
    }

    const data = (await submitRes.json()) as {
      success?: boolean;
      executed?: boolean;
      error?: string;
    };
    if (data.error) throw new Error(data.error);

    setSigned((current) => (current.includes(person) ? current : [...current, person]));
    return Boolean(data.executed);
  }, [authenticated, privyReady, wallet, walletPublicKey]);

  // Put the plan on chain, then let the other debtors sign. Each signature is
  // a real transaction, so they land one at a time and the list fills in.
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const res = await fetch("/api/settle", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ nonce: Math.random().toString(36).slice(2, 12) }),
        });
        const data = (await res.json()) as {
          scheduleId?: string;
          transfers?: Transfer[];
          error?: string;
        };
        if (data.error || !data.scheduleId || !data.transfers) {
          throw new Error(data.error ?? t("We couldn't create the settlement", "No se pudo crear la liquidación"));
        }

        setScheduleId(data.scheduleId);
        setTransfers(data.transfers);

        if (hasRealWallet) {
          for (const person of data.transfers.map((t) => t.from).filter((p) => p !== "tu")) {
            await sign(data.scheduleId, person);
          }
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [sign]);

  if (error) {
    return (
      <main className="phone">
        <div className="screen-head">
          <Link href="/plan" className="back" aria-label={t("Back to plan", "Volver al plan")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="title">{t("Waiting for everyone", "Esperando a todos")}</h1>
        </div>
        <p style={{ padding: "0 22px", color: "var(--owed)", fontSize: 14, lineHeight: 1.5 }}>
          {t("We couldn't prepare the settlement", "No se pudo preparar la liquidación")}: {error}
        </p>
      </main>
    );
  }

  if (!transfers || !scheduleId) {
    return (
      <main className="phone">
        <div className="screen-head">
          <h1 className="title">{t("Waiting for everyone", "Esperando a todos")}</h1>
        </div>
        <PayingNotice />
      </main>
    );
  }

  const payers = transfers.map((t) => t.from);
  const yours = transfers.find((t) => t.from === "tu");
  const receivers = [...new Set(transfers.map((t) => t.to))];
  const othersReady = payers.filter((p) => p !== "tu").every((p) => signed.includes(p));

  return (
    <main className="phone">
      <div className="screen-head">
        <Link href="/plan" className="back" aria-label={t("Back to plan", "Volver al plan")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="title">{t("Waiting for everyone", "Esperando a todos")}</h1>
      </div>

      <div style={{ padding: "0 22px", display: "flex", flexDirection: "column", gap: 18, flexGrow: 1 }}>
        {walletStateMessage && (
          <div
            style={{
              border: "1px solid var(--rule)",
              background: "var(--surface-2)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12,
              color: "var(--muted)",
              lineHeight: 1.45,
            }}
          >
            {walletStateMessage}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <span className="headline-count" style={{ fontSize: 40 }}>
              {signed.length}
            </span>
            <span style={{ fontFamily: "var(--f-display)", fontSize: 23, color: "var(--muted)" }}>
              {t("of", "de")} {payers.length} {t("have confirmed", "ya confirmaron")}
            </span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {payers.map((p, i) => (
              <span
                key={`${p}-${i}`}
                style={{
                  height: 5,
                  flexGrow: 1,
                  borderRadius: 3,
                  background: i < signed.length ? "var(--settled)" : "var(--rule)",
                  transition: "background 240ms ease",
                }}
              />
            ))}
          </div>
        </div>

        <LayoutGroup>
        <div className="card">
          {[...transfers]
            .sort((a, b) => Number(signed.includes(b.from)) - Number(signed.includes(a.from)))
            .map((transfer) => {
              const isYou = transfer.from === "tu";
              const done = signed.includes(transfer.from);
              return (
                <motion.div
                  layout
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  className={!done && isYou ? "row awaiting" : "row"}
                  key={transfer.from}
                  style={!done && isYou ? { background: "var(--surface-2)" } : undefined}
                >
                  <span className={isYou ? "avatar you" : "avatar"} style={{ width: 34, height: 34 }}>
                    {personInitialFor(transfer.from)}
                  </span>
                  <span className="grow" style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontSize: 14.5, fontWeight: isYou ? 600 : 500 }}>
                      {personNameFor(transfer.from)}
                    </span>
                    <span style={{ fontSize: 11.5, color: done ? "var(--settled)" : "var(--muted)" }}>
                      {done ? t("Confirmed", "Confirmó") : isYou ? t("Your confirmation is needed", "Falta tu confirmación") : t("Signing…", "Firmando…")} ·{" "}
                      {formatCents(transfer.cents)}
                    </span>
                  </span>
                  <AnimatePresence mode="wait" initial={false}>
                    {done ? (
                      <motion.svg
                        key="done"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--settled)"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 420, damping: 18 }}
                      >
                        <path d="M4 12.5l5 5L20 6.5" />
                      </motion.svg>
                    ) : (
                      <motion.span
                        key="pending"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: `1.6px dashed ${isYou ? "var(--owed)" : "var(--rule)"}`,
                          display: "block"
                        }}
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
        </div>
        </LayoutGroup>

        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 3px" }}>
          <span style={{ display: "flex", gap: 5 }}>
            {receivers.map((r) => (
              <span key={r} className="avatar" style={{ width: 26, height: 26, fontSize: 10.5 }}>
                {personInitialFor(r)}
              </span>
            ))}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {receivers.map(personNameFor).join(", ").replace(/, ([^,]*)$/, locale === "es" ? " y $1" : " and $1")} {t("only receive.", "solo reciben.")}
          </span>
        </div>

        <div className="note-card">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--settled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M12 3l7.5 3v5.4c0 4.4-3.1 8.2-7.5 9.6-4.4-1.4-7.5-5.2-7.5-9.6V6z" />
            <path d="M8.8 12.2l2.3 2.3 4.1-4.6" />
          </svg>
          <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>
              {t(`Nobody pays until all ${payers.length} confirm.`, `Nadie paga hasta que los ${payers.length} confirmen.`)}
            </span>
            <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.45, textWrap: "pretty" }}>
              {t(`These ${transfers.length} transfers are one pending transaction. It cannot execute halfway: it all goes through, or none of it does.`, `Las ${transfers.length} transferencias son una sola transacción pendiente. No puede ejecutarse a medias: sale completa o no sale.`)}
            </span>
          </span>
        </div>
      </div>

      <div style={{ padding: "0 22px 24px", display: "flex", flexDirection: "column", gap: 11 }}>
        {yours && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 3px" }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{t("Your part", "Tu parte")}</span>
            <span className="money" style={{ fontSize: 15, fontWeight: 500 }}>
              {formatCents(yours.cents)}{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400 }}>{t("to", "a")} {personNameFor(yours.to)}</span>
            </span>
          </div>
        )}
        <button
          type="button"
          className="btn btn-settle"
          disabled={!othersReady || busy || signed.includes("tu")}
          onClick={async () => {
            setBusy(true);
            try {
              await sign(scheduleId, "tu");
              router.push(`/done?schedule=${encodeURIComponent(scheduleId)}`);
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? t("Settling…", "Liquidando…") : othersReady ? t("Confirm my part", "Confirmar mi parte") : t("Waiting for the others…", "Esperando a los demás…")}
        </button>
      </div>
    </main>
  );
}
