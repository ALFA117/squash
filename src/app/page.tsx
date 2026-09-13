"use client";

import { LogoMark, Wordmark } from "@/components/Logo";
import { Logo3D } from "@/components/Logo3D";
import { PressLink } from "@/components/Press";
import { Reveal } from "@/components/Reveal";
import { DebtGraph } from "@/components/DebtGraph";
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
        <section className="lp-dollars" aria-labelledby="lp-dollars-title">
          <div className="lp-dollars-copy">
            <span className="lp-kicker">{t("Real money, exactly", "Dinero real, exacto")}</span>
            <h2 id="lp-dollars-title">{t("Pesos in, real dollars out", "Entran pesos, salen dólares de verdad")}</h2>
            <ul className="lp-points">
              <Point icon={<path d="M3 12h4l3-8 4 16 3-8h4" />}>
                <strong>{t("Today's rate, frozen.", "El tipo de cambio de hoy, congelado.")}</strong>{" "}
                {t("It is fixed on the bill the moment confirmations start, so everyone agrees to the exact dollars that move.", "Se fija en la cuenta al pedir confirmaciones: todos aceptan exactamente los dólares que se van a mover.")}
              </Point>
              <Point icon={<path d="M12 3v18M7 8h7a3 3 0 010 6H9a3 3 0 000 6h8" />}>
                <strong>{t("Not a cent lost.", "Sin perder un centavo.")}</strong>{" "}
                {t("The dollar shares always add up to the converted total.", "Las partes en dólares siempre suman el total convertido.")}
              </Point>
              <Point icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 10h4.5a1.5 1.5 0 010 3H10a1.5 1.5 0 000 3h5" /></>}>
                <strong>{t("Dollars on Hedera.", "Dólares en Hedera.")}</strong>{" "}
                {t("On testnet they are tUSD, a token where one unit is one cent; on mainnet the same code settles in USDC.", "En pruebas son tUSD, un token donde una unidad es un centavo; en la red principal el mismo código liquida en USDC.")}
              </Point>
            </ul>
          </div>

          <div className="lp-fx-card" aria-live="polite">
            <span className="label">{t("A $2,500 DINNER, TODAY", "UNA CENA DE $2,500, HOY")}</span>
            <div className="lp-fx-row">
              <span className="lp-fx-big">{formatCents(SAMPLE_BILL)}</span>
              <span className="lp-fx-unit">MXN</span>
            </div>
            <svg className="lp-fx-arrow" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v16M6 14l6 6 6-6" />
            </svg>
            <div className="lp-fx-row">
              <span className="lp-fx-big lp-fx-usd">{rate ? formatUsd(Math.round(SAMPLE_BILL * rate.usdPerUnit)) : "US$—"}</span>
            </div>
            <span className="lp-fx-rate">
              {rate ? t(`1 MXN = ${rate.usdPerUnit} USD · ${rate.asOf}`, `1 MXN = ${rate.usdPerUnit} USD · ${rate.asOf}`) : t("Getting today's rate…", "Consultando el tipo de cambio…")}
            </span>
            <a className="lp-chip" href={TOKEN_URL} target="_blank" rel="noreferrer">
              tUSD · Hedera ↗
            </a>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="lp-bento" aria-labelledby="lp-bento-title">
          <header className="lp-bento-head">
            <span className="lp-kicker">{t("How it holds together", "Cómo se sostiene")}</span>
            <h2 id="lp-bento-title">{t("Four pieces, one promise", "Cuatro piezas, una sola promesa")}</h2>
          </header>

          <article className="bento bento-hedera">
            <BentoIcon><path d="M4 12.5l5 5L20 6.5" /></BentoIcon>
            <span className="bento-by">Hedera · Scheduled Transactions</span>
            <h3>{t("Nobody pays until the last yes", "Nadie paga hasta el último sí")}</h3>
            <p>
              {t(
                "Every payment of the bill is one transaction waiting on chain. It executes the moment the last person confirms — and if one person never does, no money moves for anyone.",
                "Todos los pagos de la cuenta son una sola transacción esperando en la cadena. Se ejecuta en cuanto confirma el último — y si alguien nunca confirma, no se mueve el dinero de nadie.",
              )}
            </p>
            <div className="bento-meter" aria-hidden="true">
              <span className="on" /><span className="on" /><span className="on" /><span />
            </div>
          </article>

          <article className="bento bento-x402">
            <BentoIcon><path d="M4 7h16M4 12h10M4 17h6" /></BentoIcon>
            <span className="bento-by">x402 · Blocky402</span>
            <h3>{t("The engine charges per use", "El motor cobra por uso")}</h3>
            <p>
              {t("Each plan is bought over x402: a 402, a payment, the answer. No API key, no subscription — and the fee is sponsored.", "Cada plan se compra con x402: un 402, un pago, la respuesta. Sin llave de API ni suscripción — y la comisión va patrocinada.")}
            </p>
          </article>

          <article className="bento bento-privy">
            <BentoIcon><><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M16 14.5h2" /></></BentoIcon>
            <span className="bento-by">Privy</span>
            <h3>{t("Get paid in your own wallet", "Cobra en tu propia cartera")}</h3>
            <p>
              {t("Whoever paid signs in with an email and the money lands in a wallet they own — no seed phrase, no crypto words.", "Quien pagó entra con su correo y el dinero llega a una cartera suya — sin frases secretas ni palabras cripto.")}
            </p>
          </article>

          <article className="bento bento-world">
            <BentoIcon><><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" /></></BentoIcon>
            <span className="bento-by">World ID · Selfie Check</span>
            <h3>{t("One real person, one seat", "Una persona real, un lugar")}</h3>
            <p>
              {t("Tables can ask for verified people: no fake guests, nobody holding two seats — and a lost seat comes back by verifying again.", "La mesa puede pedir personas verificadas: sin invitados falsos ni alguien con dos lugares — y si pierdes tu lugar, lo recuperas verificándote otra vez.")}
            </p>
          </article>
        </section>
      </Reveal>

      <Reveal>
        <section className="lp-engine" aria-labelledby="lp-engine-title">
          <div className="lp-engine-graph">
            <DebtGraph nodes={VALLE_DE_BRAVO.people.map((p) => ({ id: p.id, initial: p.initial, name: p.name, isYou: p.isYou }))} grossEdges={grossEdges} transfers={transfers} />
          </div>
          <div className="lp-engine-copy">
            <span className="lp-kicker">{t("For a whole trip", "Para un viaje entero")}</span>
            <h2 id="lp-engine-title">{t("Squashed to the provable minimum", "Comprimido al mínimo demostrable")}</h2>
            <div className="lp-engine-numbers">
              <span className="lp-n" style={{ color: "var(--owed)" }}>{grossEdges.length}</span>
              <svg width="30" height="16" viewBox="0 0 34 18" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 9h29M24 3l7 6-7 6" />
              </svg>
              <span className="lp-n" style={{ color: "var(--settled)" }}>{transfers.length}</span>
            </div>
            <p className="lp-engine-cap">
              {t(
                `${grossEdges.length} crossed debts between ${people} friends become ${transfers.length} payments — ${Math.round(compression * 100)}% fewer. Not an estimate: the most disjoint groups that sum to zero, found exactly.`,
                `${grossEdges.length} deudas cruzadas entre ${people} amigos se vuelven ${transfers.length} pagos — ${Math.round(compression * 100)}% menos. No es un estimado: los grupos disjuntos que suman cero, encontrados exactamente.`,
              )}
            </p>
            <PressLink href="/join" className="btn btn-ghost lp-engine-cta">
              {t("Open the sample trip", "Abrir el viaje de ejemplo")}
            </PressLink>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="lp-proofs" aria-labelledby="lp-proofs-title">
          <h2 id="lp-proofs-title">{t("Everything can be checked", "Todo se puede verificar")}</h2>
          <p className="lp-muted">{t("Every claim on this page opens on HashScan, Hedera's public explorer.", "Cada afirmación de esta página se abre en HashScan, el explorador público de Hedera.")}</p>
          <div className="lp-chips">
            <a className="lp-chip" href="https://hashscan.io/testnet/transaction/0.0.7162784-1789249485-560257425" target="_blank" rel="noreferrer">{t("A plan paid over x402 ↗", "Un plan pagado con x402 ↗")}</a>
            <a className="lp-chip" href="https://hashscan.io/testnet/schedule/0.0.10510675" target="_blank" rel="noreferrer">{t("A bill settled on the last yes ↗", "Una cuenta liquidada con el último sí ↗")}</a>
            <a className="lp-chip" href="https://hashscan.io/testnet/transaction/0.0.10450391-1789253509-329841529" target="_blank" rel="noreferrer">{t("US$88.40 moved in tUSD ↗", "US$88.40 movidos en tUSD ↗")}</a>
            <a className="lp-chip" href="https://hashscan.io/testnet/topic/0.0.10452145" target="_blank" rel="noreferrer">{t("Proof of every run (HCS) ↗", "Prueba de cada cálculo (HCS) ↗")}</a>
            <a className="lp-chip" href="https://github.com/ALFA117/squash" target="_blank" rel="noreferrer">{t("The code ↗", "El código ↗")}</a>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="lp-final">
          <LogoMark size={64} className="lp-final-mark" />
          <h2>{t("Is the bill already here?", "¿Ya llegó la cuenta?")}</h2>
          <p>{t("Open it, show the QR, and let the table say yes.", "Ábrela, enseña el QR y deja que la mesa diga que sí.")}</p>
          <PressLink href="/nuevo" className="btn lp-final-cta">
            {t("Split a bill", "Dividir una cuenta")}
          </PressLink>
        </section>
      </Reveal>

      <footer className="lp-foot2">
        <div className="lp-foot2-brand">
          <LogoMark size={26} />
          <Wordmark width={84} />
        </div>
        <p>
          {t(
            "Hedera testnet. The exchange rate, the charge for the plan and the settlement really happen; the people at the table settle from test accounts the app holds, and the dollars are test dollars.",
            "Red de pruebas de Hedera. El tipo de cambio, el cobro por el plan y la liquidación ocurren de verdad; la gente en la mesa liquida desde cuentas de prueba que tiene la app, y los dólares son de prueba.",
          )}
        </p>
        <span className="lp-muted">Squash · ETHOnline 2026</span>
      </footer>
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

function Point({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li>
      <span className="lp-point-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

function BentoIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="bento-icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}
