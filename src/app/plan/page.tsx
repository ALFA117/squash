"use client";

import Link from "next/link";
import { DebtGraph } from "@/components/DebtGraph";
import { formatCents } from "@/lib/netting";
import { personInitial, personName, VALLE_DE_BRAVO as GROUP } from "@/lib/sample";
import { usePlan } from "@/lib/usePlan";

export default function PlanScreen() {
  const { plan, error } = usePlan();

  const nodes = GROUP.people.map((p) => ({
    id: p.id,
    initial: p.initial,
    isYou: p.isYou,
  }));

  return (
    <main className="phone">
      <div className="screen-head">
        <Link href="/" className="back" aria-label="Volver al grupo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="title">Plan de liquidación</h1>
      </div>

      {error && (
        <p style={{ padding: "0 22px", color: "var(--owed)", fontSize: 14 }}>
          No se pudo calcular el plan: {error}
        </p>
      )}

      {!plan && !error && (
        <p style={{ padding: "0 22px", color: "var(--muted)", fontSize: 14 }}>
          Calculando el plan…
        </p>
      )}

      {plan && (
        <>
          <section style={{ padding: "0 22px", display: "flex", flexDirection: "column", gap: 4 }}>
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
              transferencias en vez de {plan.grossEdges.length} ·{" "}
              <strong style={{ color: "var(--settled)", fontWeight: 500 }}>
                {Math.round(plan.compression * 100)}% menos comisiones
              </strong>
            </span>
          </section>

          <section style={{ padding: "4px 22px 0" }}>
            <DebtGraph nodes={nodes} grossEdges={plan.grossEdges} transfers={plan.transfers} />
          </section>

          <section style={{ padding: "4px 22px 0", display: "flex", flexDirection: "column", gap: 7 }}>
            <span className="label">LO QUE SE MUEVE</span>
            <div className="card">
              {plan.transfers.map((t) => (
                <div className="row" key={`${t.from}-${t.to}`} style={{ gap: 10 }}>
                  <div className={t.from === "tu" ? "avatar sm you" : "avatar sm"}>
                    {personInitial(t.from)}
                  </div>
                  <svg width="15" height="10" viewBox="0 0 15 10" fill="none" stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M0 5h12M9 1l4 4-4 4" />
                  </svg>
                  <div className="avatar sm">{personInitial(t.to)}</div>
                  <span className="grow" style={{ fontSize: 14.5, marginLeft: 3 }}>
                    {personName(t.to)}
                  </span>
                  <span className="money" style={{ fontSize: 15, fontWeight: 500 }}>
                    {formatCents(t.cents)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="foot" style={{ gap: 10, border: "none" }}>
            <div className="receipt">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
              <span className="grow">
                cálculo del plan · {plan.price.obligations} obligaciones
                {plan.paid && plan.receipt ? " · pagado" : plan.cached ? " · en caché" : ""}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{plan.price.hbar} ℏ</span>
            </div>
            <Link className="btn btn-settle" href="/sign">
              Confirmar y firmar
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
