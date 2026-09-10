"use client";

import Link from "next/link";
import { PayingNotice } from "@/components/PayingNotice";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCents } from "@/lib/netting";
import { personInitial, personName } from "@/lib/sample";
import { usePlan } from "@/lib/usePlan";

/**
 * Waiting for signatures.
 *
 * Only the parties whose money moves have to sign — the receivers do not.
 * That mirrors how the settlement is actually assembled: one scheduled
 * transaction that stays pending until every debited account has signed, and
 * then executes as a single unit. Nobody pays until everybody has.
 */
export default function SignScreen() {
  const router = useRouter();
  const { plan, error } = usePlan();
  const [signed, setSigned] = useState<string[]>([]);

  if (error) {
    return (
      <main className="phone">
        <div className="screen-head">
          <h1 className="title">Esperando a todos</h1>
        </div>
        <p style={{ padding: "0 22px", color: "var(--owed)", fontSize: 14 }}>
          No se pudo cargar el plan: {error}
        </p>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="phone">
        <div className="screen-head">
          <h1 className="title">Esperando a todos</h1>
        </div>
        <PayingNotice />
      </main>
    );
  }

  // Everyone who is debited signs. Sample state: the other two are already in.
  const payers = plan.transfers.map((t) => t.from);
  const others = payers.filter((p) => p !== "tu");
  const confirmed = [...others, ...signed];
  const yours = plan.transfers.find((t) => t.from === "tu");
  const receivers = [...new Set(plan.transfers.map((t) => t.to))];

  return (
    <main className="phone">
      <div className="screen-head">
        <Link href="/plan" className="back" aria-label="Volver al plan">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="title">Esperando a todos</h1>
      </div>

      <div style={{ padding: "0 22px", display: "flex", flexDirection: "column", gap: 18, flexGrow: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <span className="headline-count" style={{ fontSize: 40 }}>
              {confirmed.length}
            </span>
            <span style={{ fontFamily: "var(--f-display)", fontSize: 23, color: "var(--muted)" }}>
              de {payers.length} ya confirmaron
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
                  background: i < confirmed.length ? "var(--settled)" : "var(--rule)",
                }}
              />
            ))}
          </div>
        </div>

        <div className="card">
          {/* Whoever is still missing goes last, so the screen reads as a
              queue closing in on the one signature that is left. */}
          {[...plan.transfers]
            .sort((a, b) => Number(confirmed.includes(b.from)) - Number(confirmed.includes(a.from)))
            .map((t) => {
            const isYou = t.from === "tu";
            const done = confirmed.includes(t.from);
            return (
              <div className="row" key={t.from} style={done || !isYou ? undefined : { background: "var(--surface-2)" }}>
                <span className={isYou ? "avatar you" : "avatar"} style={{ width: 34, height: 34 }}>
                  {personInitial(t.from)}
                </span>
                <span className="grow" style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 14.5, fontWeight: isYou ? 600 : 500 }}>
                    {personName(t.from)}
                  </span>
                  <span style={{ fontSize: 11.5, color: done ? "var(--settled)" : "var(--owed)" }}>
                    {done ? "Confirmó" : "Falta su confirmación"} · {formatCents(t.cents)}
                  </span>
                </span>
                {done ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--settled)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                ) : (
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "1.6px dashed var(--owed)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 3px" }}>
          <span style={{ display: "flex", gap: 5 }}>
            {receivers.map((r) => (
              <span key={r} className="avatar" style={{ width: 26, height: 26, fontSize: 10.5 }}>
                {personInitial(r)}
              </span>
            ))}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {receivers.map(personName).join(", ").replace(/, ([^,]*)$/, " y $1")} solo reciben.
          </span>
        </div>

        <div className="note-card">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--settled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M12 3l7.5 3v5.4c0 4.4-3.1 8.2-7.5 9.6-4.4-1.4-7.5-5.2-7.5-9.6V6z" />
            <path d="M8.8 12.2l2.3 2.3 4.1-4.6" />
          </svg>
          <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>
              Nadie paga hasta que los {payers.length} confirmen.
            </span>
            <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.45, textWrap: "pretty" }}>
              Si alguien se arrepiente, no se mueve un solo peso. Las {plan.transfers.length}{" "}
              transferencias salen juntas o no salen.
            </span>
          </span>
        </div>
      </div>

      <div style={{ padding: "0 22px 24px", display: "flex", flexDirection: "column", gap: 11 }}>
        {yours && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 3px" }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Tu parte</span>
            <span className="money" style={{ fontSize: 15, fontWeight: 500 }}>
              {formatCents(yours.cents)}{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400 }}>a {personName(yours.to)}</span>
            </span>
          </div>
        )}
        <button
          type="button"
          className="btn btn-settle"
          onClick={() => {
            setSigned(["tu"]);
            setTimeout(() => router.push("/done"), 450);
          }}
          disabled={signed.length > 0}
        >
          {signed.length > 0 ? "Liquidando…" : "Confirmar mi parte"}
        </button>
      </div>
    </main>
  );
}
