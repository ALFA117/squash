"use client";

import { LogoMark, Wordmark } from "@/components/Logo";
import { Logo3D } from "@/components/Logo3D";
import { PressLink } from "@/components/Press";
import { Reveal } from "@/components/Reveal";
import { useLocale } from "@/components/Locale";
import { formatUsd } from "@/lib/money";
import { formatCents, netExpenses } from "@/lib/netting";
import { VALLE_DE_BRAVO } from "@/lib/sample";
import { useUsdRate } from "@/lib/useUsdRate";

const TOKEN_URL = "https://hashscan.io/testnet/token/0.0.10511085";
const SAMPLE_BILL = 250_000; // $2,500.00 MXN

/**
 * The front door.
 *
 * It leads with the thing a person does — split a bill at the table — and
 * then shows why it can be trusted: the dollars are real dollars at today's
 * rate, nobody pays until everyone agrees, and every number links to the
 * chain. The engine numbers are computed by the same solver the product
 * runs, not typed in.
 */
export default function Landing() {
  const { t } = useLocale();
  const { grossEdges, transfers, compression } = netExpenses(VALLE_DE_BRAVO.expenses);
  const people = VALLE_DE_BRAVO.people.length;
  const rate = useUsdRate("MXN");

  return (
    <main className="landing">
      <nav className="lp-top" aria-label="Squash">
        <LogoMark size={36} />
        <Wordmark width={116} />
      </nav>

      <header className="lp-hero">
        <div className="lp-hero-copy">
          <span className="lp-kicker">{t("Split the bill · Hedera", "Divide la cuenta · Hedera")}</span>
          <h1>
            {t("Nobody pays until", "Nadie paga hasta que")} <span className="lp-accent">{t("everyone says yes.", "todos digan que sí.")}</span>
          </h1>
          <p className="lp-lead">
            {t(
              "One person pays the dinner and shows a QR. Everyone scans it, sees their share live, and taps yes. The pesos become dollars at today's rate, and one transaction settles it all — only on the last yes.",
              "Una persona paga la cena y enseña un QR. Todos lo escanean, ven su parte en vivo y dicen que sí. Los pesos se vuelven dólares al tipo de cambio de hoy, y una sola transacción liquida todo — solo con el último sí.",
            )}
          </p>
          <div className="lp-cta">
            <PressLink href="/nuevo" className="btn btn-dark lp-cta-main">
              {t("Split a bill", "Dividir una cuenta")}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </PressLink>
            <PressLink href="/join" className="btn btn-ghost lp-cta-alt">
              {t("See the sample trip", "Ver el viaje de ejemplo")}
            </PressLink>
          </div>
        </div>
        <div className="lp-hero-mark">
          <Logo3D alt={t("Squash logo: an eye inside a network of connections", "Logo de Squash: un ojo dentro de una red de conexiones")} />
        </div>
      </header>

      <Reveal>
        <section className="lp-flow" aria-label={t("How it works at the table", "Cómo funciona en la mesa")}>
          <FlowStep
            n={1}
            title={t("Scan the QR", "Escanean el QR")}
            body={t("Whoever paid opens the bill. Everyone else scans in and sees who they are and what they owe.", "Quien pagó abre la cuenta. Los demás escanean y ven quiénes son y cuánto deben.")}
            icon={<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2z" />}
          />
          <FlowStep
            n={2}
            title={t("Pick the split", "Eligen cómo dividir")}
            body={t("Equal parts to the cent, amounts the payer sets, or each person enters their own.", "Partes iguales al centavo, montos que pone quien pagó, o cada quien escribe lo suyo.")}
            icon={<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8" />}
          />
          <FlowStep
            n={3}
            title={t("Everyone says yes", "Todos dicen que sí")}
            body={t("It is one pending transaction on Hedera. The last yes executes it. If one person never agrees, nobody pays.", "Es una sola transacción pendiente en Hedera. El último sí la ejecuta. Si alguien no acepta, nadie paga.")}
            icon={<path d="M4 12.5l5 5L20 6.5" />}
          />
        </section>
      </Reveal>

      <Reveal>
        <section className="lp-section">
          <h2>{t("Pesos in, real dollars out", "Entran pesos, salen dólares de verdad")}</h2>
          <div className="lp-fx" aria-live="polite">
            <div>
              <span className="lp-fx-n">{formatCents(SAMPLE_BILL)}</span>
              <span className="lp-cap">MXN · {t("the bill", "la cuenta")}</span>
            </div>
            <svg width="30" height="16" viewBox="0 0 34 18" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 9h29M24 3l7 6-7 6" />
            </svg>
            <div>
              <span className="lp-fx-n lp-fx-usd">{rate ? formatUsd(Math.round(SAMPLE_BILL * rate.usdPerUnit)) : "US$—"}</span>
              <span className="lp-cap">
                {rate
                  ? t(`at ${rate.usdPerUnit} USD per peso, ${rate.asOf}`, `a ${rate.usdPerUnit} USD por peso, ${rate.asOf}`)
                  : t("today's rate", "tipo de cambio de hoy")}
              </span>
            </div>
          </div>
          <p>
            {t(
              "When confirmations start, each share is converted once at today's rate and frozen on the bill, so everyone agrees to the exact dollar amount that moves. Rounding never loses a cent: the dollar shares always add up to the converted total.",
              "Al pedir confirmaciones, cada parte se convierte una sola vez al tipo de cambio del día y queda congelada en la cuenta, así que todos aceptan exactamente los dólares que se van a mover. El redondeo no pierde centavos: las partes en dólares siempre suman el total convertido.",
            )}
          </p>
          <p className="lp-muted">
            {t("On testnet the dollars are", "En la red de pruebas los dólares son")}{" "}
            <a href={TOKEN_URL} target="_blank" rel="noreferrer">tUSD</a>
            {t(
              ", a Hedera token where one unit is one cent. On mainnet the same code settles in USDC.",
              ", un token de Hedera donde una unidad es un centavo. En la red principal el mismo código liquida en USDC.",
            )}
          </p>
        </section>
      </Reveal>

      <Reveal>
        <section className="lp-numbers" aria-label={t("The engine", "El motor")}>
          <div>
            <span className="lp-n" style={{ color: "var(--owed)" }}>
              {grossEdges.length}
            </span>
            <span className="lp-cap">{t("crossed debts between", "deudas cruzadas entre")} {people} {t("people", "personas")}</span>
          </div>
          <svg width="34" height="18" viewBox="0 0 34 18" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 9h29M24 3l7 6-7 6" />
          </svg>
          <div>
            <span className="lp-n" style={{ color: "var(--settled)" }}>
              {transfers.length}
            </span>
            <span className="lp-cap">{t("transfers", "transferencias")} · {Math.round(compression * 100)}% {t("fewer", "menos")}</span>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="lp-section">
          <h2>{t("A whole trip, squashed to the minimum", "Un viaje entero, comprimido al mínimo")}</h2>
          <p>
            {t(
              "When a group has been paying for each other for days, the debts cross. The engine finds the provable minimum number of transfers: every plan splits into groups that sum to zero, a group of",
              "Cuando un grupo lleva días pagándose cosas, las deudas se cruzan. El motor encuentra el mínimo demostrable de transferencias: todo plan se descompone en grupos que suman cero, un grupo de",
            )}{" "}
            <em>k</em> {t("costs", "cuesta")} <em>k−1</em>
            {t(", and the most disjoint groups are found exactly.", ", y se encuentran exactamente los más grupos disjuntos posibles.")}
          </p>
        </section>
      </Reveal>

      <Reveal>
        <section className="lp-section">
          <h2>{t("The engine charges per use, over x402", "El motor cobra por uso, con x402")}</h2>
          <p>
            {t("Every settlement plan — including each bill at the table — is bought from the engine:", "Cada plan de liquidación — incluida cada cuenta en la mesa — se le compra al motor:")}{" "}
            {t("it answers", "responde")} <code>402</code>
            {t(
              ", the app pays in HBAR, and the facilitator sponsors the network fee. No API key, no subscription.",
              ", la app paga en HBAR y el facilitador cubre la comisión de la red. Sin llave de API, sin suscripción.",
            )}
          </p>
          <div className="lp-proof">
            <a href="https://hashscan.io/testnet/transaction/0.0.7162784-1789249485-560257425" target="_blank" rel="noreferrer">
              {t("A bill's plan, paid over x402 ↗", "El plan de una cuenta, pagado con x402 ↗")}
            </a>
            <a href="https://hashscan.io/testnet/topic/0.0.10452145" target="_blank" rel="noreferrer">
              {t("Proof of every run, published ↗", "La prueba de cada cálculo, publicada ↗")}
            </a>
            <a href={TOKEN_URL} target="_blank" rel="noreferrer">
              {t("The dollar token ↗", "El token de dólares ↗")}
            </a>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <footer className="lp-foot">
          <p>
            <strong>{t("What is real and what is demo.", "Qué es real y qué es demo.")}</strong>{" "}
            {t(
              "The exchange rate, the charge for the plan, and the settlement all really happen on Hedera testnet, and each one opens in the explorer. What is demo: the people at the table settle from test accounts the app holds, and the dollars are test dollars. A product gives each person their own wallet.",
              "El tipo de cambio, el cobro por el plan y la liquidación ocurren de verdad en la red de pruebas de Hedera, y cada uno se abre en el explorador. Lo que es demo: la gente en la mesa liquida desde cuentas de prueba que tiene la app, y los dólares son de prueba. Un producto le da a cada quien su propia cartera.",
            )}{" "}
            <a href="https://github.com/ALFA117/squash" target="_blank" rel="noreferrer">
              {t("The code ↗", "El código ↗")}
            </a>
          </p>
          <p className="lp-muted">Squash · ETHOnline 2026 · Hedera testnet</p>
        </footer>
      </Reveal>
    </main>
  );
}

function FlowStep({ n, title, body, icon }: { n: number; title: string; body: string; icon: React.ReactNode }) {
  return (
    <article className="lp-step">
      <div className="lp-step-top">
        <span className="lp-step-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        </span>
        <span className="lp-step-n">0{n}</span>
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}
