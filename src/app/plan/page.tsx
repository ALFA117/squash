"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { DebtGraph } from "@/components/DebtGraph";
import { PayingNotice } from "@/components/PayingNotice";
import { useGroup } from "@/components/GroupProvider";
import { formatCents } from "@/lib/netting";
import { usePlan } from "@/lib/usePlan";
import { useLocale } from "@/components/Locale";

export default function PlanScreen() {
  const { people, expenses: groupExpenses, confirmed } = useGroup();
  const { plan, error } = usePlan(groupExpenses);
  const { t } = useLocale();
  const reducedMotion = useReducedMotion();
  const entrance = reducedMotion
    ? { duration: 0 }
    : { duration: 0.36, ease: [0.16, 1, 0.3, 1] as const };

  const nodes = people.map((p) => ({
    id: p.id,
    initial: p.initial,
    name: p.name,
    isYou: p.isYou,
  }));
  const confirmedCount = people.filter((p) => confirmed[p.id]).length;
  const allConfirmed = confirmedCount === people.length && people.length > 0;

  const personNameFor = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const personInitialFor = (id: string) => people.find((p) => p.id === id)?.initial ?? id[0]?.toUpperCase() ?? "?";

  return (
    <main className="phone">
      <div className="screen-head">
        <Link href="/grupo" className="back" aria-label={t("Back to group", "Volver al grupo")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="title">{t("Settlement plan", "Plan de liquidación")}</h1>
      </div>

      {error && (
        <p role="alert" style={{ padding: "0 22px", color: "var(--owed)", fontSize: 14 }}>
          {t("We couldn't calculate the plan", "No se pudo calcular el plan")}: {error}
        </p>
      )}

      {!plan && !error && <PayingNotice />}

      {plan && (
        <>
          <motion.section
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={entrance}
            style={{ padding: "0 22px", display: "flex", flexDirection: "column", gap: 6 }}
          >
            <div
              className="card"
              style={{
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="label">{t("GROUP READY", "GRUPO LISTO")}</span>
                <strong style={{ fontFamily: "var(--f-mono)", fontSize: 18, letterSpacing: "-0.02em" }}>
                  {confirmedCount}/{people.length}
                </strong>
              </div>
              <span
                className={allConfirmed ? "preview-pill settled" : "preview-pill owed"}
                style={{ textTransform: "uppercase" }}
              >
                {allConfirmed ? t("Confirmed", "Confirmado") : t("Pending", "Pendiente")}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 13 }}>
              <span className="headline-count" style={{ color: "var(--owed)" }}>
                {plan.grossEdges.length}
              </span>
              <svg width="26" height="16" viewBox="0 0 26 16" fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 8h22M17 3l6 5-6 5" />
              </svg>
              <span className="headline-count" style={{ color: "var(--settled)" }}>
                {plan.transfers.length}
              </span>
            </div>
            <span style={{ fontSize: 13.5, color: "var(--muted)" }}>
              {t("transfers instead of", "transferencias en vez de")} {plan.grossEdges.length} ·{" "}
              <strong style={{ color: "var(--settled)", fontWeight: 500 }}>
                {Math.round(plan.compression * 100)}% {t("fewer fees", "menos comisiones")}
              </strong>
            </span>
          </motion.section>

          <motion.section
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? entrance : { ...entrance, delay: 0.08 }}
            style={{ padding: "4px 22px 0" }}
          >
            <DebtGraph nodes={nodes} grossEdges={plan.grossEdges} transfers={plan.transfers} />
          </motion.section>

          <motion.section
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? entrance : { ...entrance, delay: 0.16 }}
            style={{ padding: "4px 22px 0", display: "flex", flexDirection: "column", gap: 7 }}
          >
            <span className="label">{t("WHAT MOVES", "LO QUE SE MUEVE")}</span>
            <div className="card">
              {plan.transfers.map((t, index) => (
                <motion.div
                  className="row"
                  key={`${t.from}-${t.to}`}
                  initial={reducedMotion ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { duration: 0.24, delay: 0.22 + index * 0.05, ease: [0.16, 1, 0.3, 1] }
                  }
                  style={{ gap: 10 }}
                >
                  <div className={t.from === "tu" ? "avatar sm you" : "avatar sm"}>
                    {personInitialFor(t.from)}
                  </div>
                  <svg width="15" height="10" viewBox="0 0 15 10" fill="none" stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M0 5h12M9 1l4 4-4 4" />
                  </svg>
                  <div className="avatar sm">{personInitialFor(t.to)}</div>
                  <span className="grow" style={{ fontSize: 14.5, marginLeft: 3 }}>
                    {personNameFor(t.from)} <span style={{ color: "var(--muted)" }}>→</span> {personNameFor(t.to)}
                  </span>
                  <span className="money" style={{ fontSize: 15, fontWeight: 500 }}>
                    {formatCents(t.cents)}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.div
            className="foot"
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration: 0.3, delay: 0.3, ease: [0.16, 1, 0.3, 1] }
            }
            style={{ gap: 10, border: "none" }}
          >
            <div className="receipt">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
              <span className="grow">
                {t("plan calculation", "cálculo del plan")} · {plan.price.obligations} {t("obligations", "obligaciones")}
                {plan.paid && plan.receipt ? ` · ${t("paid", "pagado")}` : plan.cached ? ` · ${t("cached", "en caché")}` : ""}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{plan.price.hbar} ℏ</span>
            </div>
            {!allConfirmed && (
              <span style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
                {t("Everyone must confirm before the group can sign and settle.", "Todos deben confirmar antes de que el grupo pueda firmar y liquidar.")}
              </span>
            )}
            <Link
              className={allConfirmed ? "btn btn-settle" : "btn btn-settle"}
              href={allConfirmed ? "/sign" : "#"}
              onClick={(event) => {
                if (!allConfirmed) {
                  event.preventDefault();
                }
              }}
              style={{ opacity: allConfirmed ? 1 : 0.6, pointerEvents: allConfirmed ? "auto" : "none" }}
            >
              {allConfirmed ? t("Confirm and sign", "Confirmar y firmar") : t("Waiting for confirmations", "Esperando confirmaciones")}
            </Link>
          </motion.div>
        </>
      )}
    </main>
  );
}
