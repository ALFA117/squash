"use client";

import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/Logo";
import { PressLink } from "@/components/Press";
import { useLocale } from "@/components/Locale";
import { useGroup } from "@/components/GroupProvider";
import { formatCents, netExpenses } from "@/lib/netting";

/**
 * The door to the sample trip.
 *
 * No sign-in stands in front of it. The trip is a demo with six fixed
 * testnet accounts; making someone create a login to look at it only adds a
 * way for the demo to stall — and an identity check the app does not
 * actually perform would be a claim, not a feature.
 */
export default function JoinScreen() {
  const { name, dates, people, expenses } = useGroup();
  const { t } = useLocale();
  const { grossEdges, transfers } = netExpenses(expenses);
  const total = expenses.reduce((sum, e) => sum + e.cents, 0);

  return (
    <main className="phone" style={{ padding: "26px 24px 24px" }}>
      <div className="brand-row">
        <LogoMark size={32} badge />
        <Wordmark width={100} />
      </div>

      <div className="join-trip">
        <span className="label">{t("SAMPLE TRIP", "VIAJE DE EJEMPLO")}</span>
        <h1 className="join-title">{name}</h1>
        <p className="join-sub">
          {people.length} {t("friends", "amigos")} · {dates}
        </p>

        <div className="join-avatars" aria-hidden="true">
          {people.map((p) => (
            <span key={p.id} className={p.isYou ? "avatar you" : "avatar"}>
              {p.initial}
            </span>
          ))}
        </div>

        <div className="join-summary">
          <div className="join-summary-item">
            <span className="label">{t("SPENT", "GASTARON")}</span>
            <strong>{formatCents(total)}</strong>
            <small>MXN</small>
          </div>
          <div className="join-summary-item">
            <span className="label">{t("DEBTS", "DEUDAS")}</span>
            <strong>
              {grossEdges.length} → {transfers.length}
            </strong>
            <small>{t("transfers", "transferencias")}</small>
          </div>
        </div>

        <ol className="join-list">
          <li>
            <strong>{t("Six friends paid for different things.", "Seis amigos pagaron cosas distintas.")}</strong>{" "}
            {t("Everyone owes everyone.", "Todos le deben a todos.")}
          </li>
          <li>
            <strong>{t("The engine finds the minimum.", "El motor encuentra el mínimo.")}</strong>{" "}
            {t(
              `${grossEdges.length} debts become ${transfers.length} payments — and the app pays for that calculation over x402.`,
              `${grossEdges.length} deudas se vuelven ${transfers.length} pagos — y la app paga ese cálculo con x402.`,
            )}
          </li>
          <li>
            <strong>{t("Everyone signs, it settles in dollars.", "Todos firman y se liquida en dólares.")}</strong>{" "}
            {t("One transaction on Hedera, executed by the last signature.", "Una sola transacción en Hedera, que ejecuta la última firma.")}
          </li>
        </ol>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <PressLink href="/grupo" className="btn btn-dark">
          {t("Open the trip", "Abrir el viaje")}
        </PressLink>
        <Link href="/nuevo" className="join-alt">
          {t("Or split a real bill with your table →", "O divide una cuenta real con tu mesa →")}
        </Link>
      </div>
    </main>
  );
}
