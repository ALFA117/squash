"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatCents } from "@/lib/netting";
import { VALLE_DE_BRAVO } from "@/lib/sample";
import { useLocale } from "@/components/Locale";

/**
 * Adding an expense.
 *
 * The split preview is computed with the same remainder rule the engine uses,
 * so what the screen shows is what the ledger will record — down to the cent.
 */
export default function ExpenseScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const people = VALLE_DE_BRAVO.people;

  const [amount, setAmount] = useState("564.00");
  const [label, setLabel] = useState(t("Highway tolls", "Casetas de la autopista"));
  const [payer, setPayer] = useState("tu");
  const [among, setAmong] = useState<string[]>(people.map((p) => p.id));

  const cents = Math.round((Number(amount.replace(/,/g, "")) || 0) * 100);

  const shares = useMemo(() => {
    const k = among.length;
    if (k === 0) return new Map<string, number>();
    const base = Math.floor(cents / k);
    const remainder = cents - base * k;
    return new Map(among.map((id, i) => [id, base + (i < remainder ? 1 : 0)]));
  }, [cents, among]);

  const toggle = (id: string) =>
    setAmong((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  return (
    <main className="phone">
      <div className="screen-head" style={{ justifyContent: "space-between" }}>
        <h1 className="title">{t("New expense", "Nuevo gasto")}</h1>
        <Link href="/grupo" className="back" style={{ marginLeft: 0, marginRight: -10 }} aria-label={t("Cancel", "Cancelar")}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
      </div>

      <div style={{ flexGrow: 1, padding: "0 22px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "6px 0 2px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 25, color: "var(--muted)" }}>$</span>
            <input
              className="amount-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              aria-label={t("Amount", "Monto")}
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span className="chip chip-on">MXN</span>
            <span className="chip">USD</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span className="label">{t("DESCRIPTION", "CONCEPTO")}</span>
          <input
            className="text-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label={t("Description", "Concepto")}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <span className="label">{t("WHO PAID", "QUIÉN PAGÓ")}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPayer(p.id)}
                className={payer === p.id ? "person-chip on" : "person-chip"}
              >
                <span className={payer === p.id ? "avatar sm you" : "avatar sm"}>{p.initial}</span>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="label">{t("SPLIT BETWEEN", "SE DIVIDE ENTRE")}</span>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
              {among.length} {t("of", "de")} {people.length}
            </span>
          </div>

          <div className="card">
            {people.map((p) => {
              const on = among.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="row split-row"
                  aria-pressed={on}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={on ? "var(--settled)" : "var(--rule)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                  <span className="grow" style={{ fontSize: 14.5, textAlign: "left" }}>
                    {p.name}
                  </span>
                  <span
                    className="money"
                    style={{ fontSize: 13.5, color: on ? "var(--muted)" : "var(--rule)" }}
                  >
                    {formatCents(shares.get(p.id) ?? 0)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 22px 24px" }}>
        <button
          type="button"
          className="btn btn-dark"
          disabled={cents <= 0 || among.length === 0}
          onClick={() => router.push("/grupo")}
        >
          {t("Save expense", "Guardar gasto")}
        </button>
      </div>
    </main>
  );
}
