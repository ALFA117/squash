import Link from "next/link";
import { formatCents, netExpenses } from "@/lib/netting";
import { personName, VALLE_DE_BRAVO } from "@/lib/sample";

export default function GroupScreen() {
  const { balances, grossEdges } = netExpenses(VALLE_DE_BRAVO.expenses);
  const you = VALLE_DE_BRAVO.people.find((p) => p.isYou)!;
  const yourBalance = balances[you.id] ?? 0;

  const creditors = VALLE_DE_BRAVO.people
    .filter((p) => (balances[p.id] ?? 0) > 0)
    .map((p) => p.name);

  const expenses = [...VALLE_DE_BRAVO.expenses].sort((a, b) => b.cents - a.cents);

  return (
    <main className="phone">
      <div className="screen-head" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <h1 className="title">{VALLE_DE_BRAVO.name}</h1>
          <span className="subtitle">
            {VALLE_DE_BRAVO.people.length} personas · {VALLE_DE_BRAVO.expenses.length} gastos
          </span>
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
        <span className="label">TU SALDO</span>
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
          {creditors.join(", ").replace(/, ([^,]*)$/, " y $1")} pusieron de más.
        </span>
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
                {VALLE_DE_BRAVO.people.find((p) => p.id === e.payer)?.initial}
              </div>
              <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 14.5, fontWeight: 500 }}>{e.label}</span>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  {e.payer === you.id ? "Tú pagaste" : `${personName(e.payer)} pagó`}
                </span>
              </div>
              <span className="money">{formatCents(e.cents)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="foot">
        <Link href="/plan" className="btn btn-settle">
          Liquidar el grupo
        </Link>
        <span style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
          {grossEdges.length} deudas cruzadas entre {VALLE_DE_BRAVO.people.length} personas
        </span>
      </div>
    </main>
  );
}
