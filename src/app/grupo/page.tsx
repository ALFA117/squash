"use client";

import Link from "next/link";
import { formatCents, netExpenses } from "@/lib/netting";
import { useLocale } from "@/components/Locale";
import { useGroup } from "@/components/GroupProvider";

export default function GroupScreen() {
  const { t, locale } = useLocale();
  const { name, people, expenses: groupExpenses, resetGroup } = useGroup();
  const { balances, grossEdges } = netExpenses(groupExpenses);
  const you = people.find((p) => p.id === "tu") ?? people[0];
  const yourBalance = balances[you.id] ?? 0;
  const totalSpent = groupExpenses.reduce((sum, expense) => sum + expense.cents, 0);
  const peopleWhoOwe = people.filter((p) => (balances[p.id] ?? 0) < 0).length;
  const peopleOwed = people.filter((p) => (balances[p.id] ?? 0) > 0).length;
  const settledPeople = people.filter((p) => (balances[p.id] ?? 0) === 0).length;

  const personNameFor = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const personInitialFor = (id: string) => people.find((p) => p.id === id)?.initial ?? id[0]?.toUpperCase() ?? "?";

  const creditors = people
    .filter((p) => (balances[p.id] ?? 0) > 0)
    .map((p) => p.name);

  const expenses = [...groupExpenses].sort((a, b) => b.cents - a.cents);

  const handleResetDemo = () => {
    if (window.confirm(t("Reset the demo group to the original trip?", "¿Reiniciar el grupo demo al viaje original?"))) {
      resetGroup();
    }
  };

  return (
    <main className="phone">
      <div className="screen-head" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <h1 className="title">{name}</h1>
          <span className="subtitle">
            {people.length} {t("people", "personas")} · {groupExpenses.length} {t("expenses", "gastos")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/expense"
            aria-label={t("Add expense", "Agregar gasto")}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--rule)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink)",
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>
      </div>

      <section
        style={{
          margin: "4px 22px 0",
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: 12,
          padding: "15px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span className="label">{t("YOUR BALANCE", "TU SALDO")}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            className="money"
            style={{
              fontSize: 31,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: yourBalance < 0 ? "var(--owed)" : "var(--settled)",
            }}
          >
            {formatCents(yourBalance)}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>MXN</span>
        </div>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          {yourBalance === 0
            ? t("You are settled for now.", "Ahora mismo estás en cero.")
            : yourBalance > 0
              ? `${t("You are owed", "Te deben")} ${formatCents(yourBalance)}.`
              : `${t("You owe", "Debes")} ${formatCents(Math.abs(yourBalance))}.`}
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
          {creditors.join(", ").replace(/, ([^,]*)$/, locale === "es" ? " y $1" : " and $1")} {t("paid more than their share.", "pusieron de más.")}
        </span>
      </section>

      <section className="group-summary">
        <div className="summary-grid">
          <div className="summary-card">
            <span className="label">{t("TOTAL SPENT", "TOTAL GASTADO")}</span>
            <strong>{formatCents(totalSpent)}</strong>
            <small>{groupExpenses.length} {t("expenses", "gastos")}</small>
          </div>
          <div className="summary-card">
            <span className="label">{t("CROSS-OWED", "DEUDAS CRUZADAS")}</span>
            <strong>{grossEdges.length}</strong>
            <small>{t("open obligations", "obligaciones abiertas")}</small>
          </div>
          <div className="summary-card">
            <span className="label">{t("OWED TO YOU", "TE DEBEN")}</span>
            <strong>{peopleOwed}</strong>
            <small>{t("people", "personas")}</small>
          </div>
          <div className="summary-card">
            <span className="label">{t("YOU OWE", "DEBES")}</span>
            <strong>{peopleWhoOwe}</strong>
            <small>{t("people", "personas")}</small>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/expense" className="btn btn-settle" style={{ width: "auto", flex: "1 1 180px", minHeight: 46, height: 46 }}>
            {t("Add expense", "Agregar gasto")}
          </Link>
          <button
            type="button"
            className="btn"
            style={{ width: "auto", flex: "1 1 140px", minHeight: 46, height: 46, background: "var(--surface)", color: "var(--ink)" }}
            onClick={handleResetDemo}
          >
            {t("Reset demo", "Reiniciar demo")}
          </button>
        </div>
      </section>

      <section style={{ padding: "18px 22px 0" }}>
        <div className="card participant-panel">
          <div className="participant-panel-head">
            <span className="label">{t("PARTICIPANTS", "PARTICIPANTES")}</span>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{settledPeople} {t("settled", "en cero")}</span>
          </div>

          {people.map((p) => {
            const balance = balances[p.id] ?? 0;
            const status =
              balance > 0
                ? t("is owed", "te debe")
                : balance < 0
                  ? t("owes", "debe")
                  : t("settled", "en cero");

            return (
              <div className="row participant-row" key={p.id}>
                <div className={p.id === "tu" ? "avatar you" : "avatar"}>{p.initial}</div>
                <div className="grow participant-meta">
                  <span>{p.name}</span>
                  <small>{status}</small>
                </div>
                <div className={balance > 0 ? "balance-chip settled" : balance < 0 ? "balance-chip owed" : "balance-chip neutral"}>
                  {formatCents(balance)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ padding: "18px 22px 0" }}>
        <div className="card">
          {expenses.map((e) => (
            <div className="row" key={e.id}>
              <div
                className={
                  e.payer === you.id ? "avatar you" : "avatar"
                }
              >
                {personInitialFor(e.payer)}
              </div>
              <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 14.5, fontWeight: 500 }}>{e.label}</span>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  {e.payer === you.id ? t("You paid", "Tú pagaste") : `${personNameFor(e.payer)} ${t("paid", "pagó")}`}
                </span>
              </div>
              <span className="money">{formatCents(e.cents)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="foot">
        <Link href="/plan" className="btn btn-settle">
          {t("Settle the group", "Liquidar el grupo")}
        </Link>
        <span style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
          {grossEdges.length} {t("crossed debts between", "deudas cruzadas entre")} {people.length} {t("people", "personas")} ·{" "}
          {t("everyone confirms on the next screens, then it settles in dollars", "todos confirman en las siguientes pantallas y se liquida en dólares")}
        </span>
      </div>
    </main>
  );
}
