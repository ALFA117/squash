"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { formatCents } from "@/lib/netting";
import { personName, VALLE_DE_BRAVO } from "@/lib/sample";
import { usePlan } from "@/lib/usePlan";
import { useLocale } from "@/components/Locale";

/**
 * Settled.
 *
 * The explorer link points at the scheduled transaction that actually
 * executed, and only renders when there is one. A dead link to a real
 * explorer is worse than no link, so with no settlement this screen says so
 * rather than inventing a hash.
 */
function Done() {
  const { plan, error } = usePlan(VALLE_DE_BRAVO.expenses);
  const { t } = useLocale();
  const scheduleId = useSearchParams().get("schedule");
  const [scheduleStatus, setScheduleStatus] = useState<{
    executed: boolean | null;
    loading: boolean;
    error: string | null;
  }>({ executed: null, loading: false, error: null });

  useEffect(() => {
    if (!scheduleId) {
      setScheduleStatus({ executed: null, loading: false, error: null });
      return;
    }

    let ignored = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const poll = async () => {
      try {
        const res = await fetch(`/api/settle?scheduleId=${encodeURIComponent(scheduleId)}`);
        const data = (await res.json()) as { executed?: boolean; error?: string };

        if (!res.ok || data.error) {
          throw new Error(data.error ?? "Failed to fetch schedule status");
        }

        if (ignored) return;

        const executed = Boolean(data.executed);

        if (executed) {
          setScheduleStatus({ executed: true, loading: false, error: null });
          return;
        }

        attempts += 1;

        if (attempts >= 20) {
          setScheduleStatus({ executed: false, loading: false, error: null });
          return;
        }

        timeoutId = setTimeout(() => {
          void poll();
        }, 2500);
      } catch (e) {
        if (ignored) return;
        setScheduleStatus({ executed: null, loading: false, error: (e as Error).message });
      }
    };

    setScheduleStatus({ executed: null, loading: true, error: null });
    void poll();

    return () => {
      ignored = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [scheduleId]);

  if (error || !plan) {
    return (
      <main className="phone done">
        <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 26 }}>
          <span style={{ color: "#d3e8dc", fontSize: 14 }}>{error ?? t("Loading…", "Cargando…")}</span>
        </div>
      </main>
    );
  }

  const explorer =
    process.env.NEXT_PUBLIC_HEDERA_NETWORK === "mainnet"
      ? "https://hashscan.io/mainnet"
      : "https://hashscan.io/testnet";
  const isVerified = scheduleStatus.executed === true;
  const title = scheduleStatus.loading
    ? t("Verifying settlement…", "Verificando liquidación…")
    : isVerified
      ? t("Everyone is settled.", "Todos en cero.")
      : t("Settlement is pending…", "Liquidación pendiente…");
  const statusText = scheduleStatus.loading
    ? t("Checking the schedule on Hedera now.", "Comprobando el schedule en Hedera ahora mismo.")
    : scheduleStatus.error
      ? scheduleStatus.error
      : isVerified
        ? t("The final scheduled transfer has executed successfully.", "La transferencia programada final ya se ejecutó correctamente.")
        : scheduleStatus.executed === false
          ? t("The schedule exists, but the final execution has not happened yet.", "El schedule existe, pero la ejecución final aún no ha ocurrido.")
          : t("Waiting for the schedule result.", "Esperando el resultado del schedule.");

  return (
    <main className="phone done">
      <div
        style={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: "40px 26px 0",
          textAlign: "center",
        }}
      >
        <svg width="76" height="76" viewBox="0 0 76 76" fill="none" aria-hidden="true">
          <circle cx="38" cy="38" r="36" fill="none" stroke="#79cfa8" strokeWidth="1.4" />
          <circle cx="38" cy="38" r="28" fill="#f1f5f1" />
          <path d="M27 38.5l7.5 7.5L50 30" fill="none" stroke="var(--settled)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: "var(--f-display)", fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.08 }}>
            {title}
          </span>
          <span style={{ fontSize: 14, color: "#d3e8dc" }}>Valle de Bravo</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "2px 0 4px" }}>
          <span className="label" style={{ color: "#d3e8dc" }}>{t("YOUR BALANCE", "TU SALDO")}</span>
          <span className="money" style={{ fontSize: 46, fontWeight: 500, letterSpacing: "-0.03em" }}>
            $0.00
          </span>
        </div>

        <div className="done-list">
          {plan.transfers.map((transfer) => (
            <div key={`${transfer.from}-${transfer.to}`} className="done-row">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#79cfa8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
              <span className="grow" style={{ fontSize: 14, textAlign: "left" }}>
                {personName(transfer.from)} <span style={{ color: "#d3e8dc" }}>{t("to", "a")}</span> {personName(transfer.to)}
              </span>
              <span className="money" style={{ fontSize: 14.5 }}>{formatCents(transfer.cents)}</span>
            </div>
          ))}
        </div>

        <span style={{ fontSize: 13.5, color: "#d3e8dc", lineHeight: 1.5, maxWidth: 290, textWrap: "pretty" }}>
          {statusText}
        </span>
      </div>

      <div style={{ padding: "0 26px 22px", display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        <Link href="/grupo" className="btn" style={{ background: "#f1f5f1", color: "var(--settled)", fontWeight: 600 }}>
          {t("Back to group", "Volver al grupo")}
        </Link>

        {scheduleId && isVerified ? (
          <a
            className="receipt-link"
            href={`${explorer}/schedule/${encodeURIComponent(scheduleId)}`}
            target="_blank"
            rel="noreferrer"
          >
            {t("View receipt", "Ver comprobante")}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
            </svg>
          </a>
        ) : !scheduleId ? (
          <span style={{ fontSize: 11.5, color: "#a9d3bf", textAlign: "center", maxWidth: 280, lineHeight: 1.45 }}>
            {t("This view did not come from a settlement — enter through the plan to move real money.", "Esta vista no vino de una liquidación — entra por el plan para mover dinero de verdad.")}
          </span>
        ) : null}
      </div>
    </main>
  );
}

export default function DoneScreen() {
  return (
    <Suspense fallback={<main className="phone done" />}>
      <Done />
    </Suspense>
  );
}
