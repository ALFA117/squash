"use client";

import { LogoMark, Wordmark } from "@/components/Logo";
import { PressLink } from "@/components/Press";
import { DebtGraph } from "@/components/DebtGraph";
import { CountUp, ReplayInView, ScrollProgress } from "@/components/LandingMotion";
import { useLocale } from "@/components/Locale";
import { formatUsd } from "@/lib/money";
import { formatCents, netExpenses } from "@/lib/netting";
import { tripPeople, VALLE_DE_BRAVO } from "@/lib/sample";
import { useLiveBills } from "@/lib/useLiveBills";
import { useUsdRate } from "@/lib/useUsdRate";

const TOKEN_URL = "https://hashscan.io/testnet/token/0.0.10511085";
const REPO_URL = "https://github.com/ALFA117/squash";
const SAMPLE_BILL = 250_000; // $2,500.00 MXN

/**
 * The front door.
 *
 * It leads with the thing a person does — split a bill at the table — and
 * then shows why it can be trusted: the dollars are exact at today's rate
 * (test dollars on Hedera testnet), nobody pays until everyone agrees, and
 * the on-chain numbers link to the chain. The engine numbers are computed by
 * the same solver the product runs, not typed in.
 */
export default function Landing() {
  const { t, locale } = useLocale();
  const { grossEdges, transfers, compression } = netExpenses(VALLE_DE_BRAVO.expenses);
  const people = VALLE_DE_BRAVO.people.length;
  const rate = useUsdRate("MXN");
  const live = useLiveBills();
  const offline = live === "offline";

  const offlineNote = offline ? (
    <p className="lp-status" role="status">
      <span className="lp-status-dot" aria-hidden="true" />
      <span>
        {t(
          "Live bills are offline right now — their database cannot be reached. The sample trip still settles end to end on Hedera testnet.",
          "Las cuentas reales están fuera de línea ahora — no se puede llegar a su base de datos. El viaje de ejemplo sigue liquidando completo en Hedera testnet.",
        )}
      </span>
    </p>
  ) : null;

  // With live bills offline, the sample trip is what works, so it takes the
  // primary button instead of a form that cannot open.
  const primary = offline
    ? { href: "/join", label: t("See the sample trip", "Ver el viaje de ejemplo") }
    : { href: "/nuevo", label: t("Split a bill", "Dividir una cuenta") };
  const secondary = offline
    ? { href: "/nuevo", label: t("Split a bill", "Dividir una cuenta") }
    : { href: "/join", label: t("See the sample trip", "Ver el viaje de ejemplo") };

  return (
    <main className="landing">
      <ScrollProgress />
      <nav className="lp-nav" aria-label="Squash">
        <a href="/" className="lp-brand" aria-label="Squash">
          <LogoMark size={30} />
          <Wordmark width={104} />
        </a>
        <div className="lp-nav-links">
          <a href="#como">{t("How it works", "Cómo funciona")}</a>
          <a href="#motor">{t("Engine", "Motor")}</a>
          <a href="#pruebas">{t("Proof", "Pruebas")}</a>
        </div>
      </nav>

      <header className="lp-hero">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">
            <span className="lp-eyebrow-dot" aria-hidden="true" />
            {t("Split the bill · Hedera testnet", "Divide la cuenta · Hedera testnet")}
          </span>
          <h1>
            {t("Nobody pays until", "Nadie paga hasta que")} <em>{t("everyone says yes.", "todos digan que sí.")}</em>
          </h1>
          <p className="lp-lead">
            {t(
              "One person pays the dinner and shows a QR. Everyone scans it, sees their share live, and taps yes. The pesos become dollars at today's rate, and one transaction settles it all — only on the last yes.",
              "Una persona paga la cena y enseña un QR. Todos lo escanean, ven su parte en vivo y dicen que sí. Los pesos se vuelven dólares al tipo de cambio de hoy, y una sola transacción liquida todo — solo con el último sí.",
            )}
          </p>
          <div className="lp-cta">
            <PressLink href={primary.href} className="lp-btn lp-btn-primary">
              {primary.label}
              <Arrow />
            </PressLink>
            <PressLink href={secondary.href} className="lp-btn lp-btn-secondary">
              {secondary.label}
            </PressLink>
          </div>
          {offlineNote}
          <dl className="lp-facts">
            <div>
              <dt>{t("Debts on the sample trip", "Deudas del viaje de ejemplo")}</dt>
              <dd>
                {grossEdges.length} → {transfers.length}
              </dd>
            </div>
            <div>
              <dt>{t("Transactions per bill", "Transacciones por cuenta")}</dt>
              <dd>1</dd>
            </div>
            <div>
              <dt>{t("Network", "Red")}</dt>
              <dd>testnet</dd>
            </div>
          </dl>
        </div>

        <BillCard rate={rate?.usdPerUnit ?? null} />
      </header>

      <section className="lp-section" id="como" aria-labelledby="lp-flow-title">
        <SectionHead
          kicker={t("At the table", "En la mesa")}
          id="lp-flow-title"
          title={t("Three steps, one yes from everyone", "Tres pasos, un sí de todos")}
        />
        <ol className="lp-steps">
          <Step
            n={1}
            title={t("Scan the QR", "Escanean el QR")}
            body={t("Whoever paid opens the bill. Everyone else scans in and sees who they are and what they owe.", "Quien pagó abre la cuenta. Los demás escanean y ven quiénes son y cuánto deben.")}
            icon={<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2z" />}
          />
          <Step
            n={2}
            title={t("Pick the split", "Eligen cómo dividir")}
            body={t("Equal parts to the cent, amounts the payer sets, or each person enters their own.", "Partes iguales al centavo, montos que pone quien pagó, o cada quien escribe lo suyo.")}
            icon={<><circle cx="12" cy="12" r="9" /><path d="M12 3v18M12 12l6.4 6.4" /></>}
          />
          <Step
            n={3}
            title={t("Everyone says yes", "Todos dicen que sí")}
            body={t("It is one pending transaction on Hedera. The last yes executes it. If one person never agrees, nobody pays.", "Es una sola transacción pendiente en Hedera. El último sí la ejecuta. Si alguien no acepta, nadie paga.")}
            icon={<path d="M4 12.5l5 5L20 6.5" />}
          />
        </ol>
      </section>

      <section className="lp-section lp-dollars" aria-labelledby="lp-dollars-title">
        <div className="lp-dollars-copy">
          <SectionHead
            kicker={t("Exact to the cent", "Exacto al centavo")}
            id="lp-dollars-title"
            title={t("Pesos in, dollars out", "Entran pesos, salen dólares")}
          />
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
              {t("Here they are tUSD, a Hedera testnet token where one unit is one cent and nothing is worth real money. The token is a setting; nothing runs on mainnet.", "Aquí son tUSD, un token de la red de pruebas de Hedera donde una unidad es un centavo y nada vale dinero real. El token es configurable; nada corre en la red principal.")}
            </Point>
          </ul>
        </div>

        <div className="lp-fx" aria-live="polite">
          <div className="lp-fx-head">
            <span>{t("A $2,500 dinner, today", "Una cena de $2,500, hoy")}</span>
            <a href={TOKEN_URL} target="_blank" rel="noreferrer">
              tUSD · HashScan <Ext />
            </a>
          </div>
          <div className="lp-fx-line">
            <span className="lp-fx-cur">MXN</span>
            <CountUp className="lp-fx-big" to={SAMPLE_BILL} format={(v) => formatCents(Math.round(v))} />
          </div>
          <div className="lp-fx-sep" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v16M6 14l6 6 6-6" />
            </svg>
            <span>
              {rate
                ? `1 MXN = ${rate.usdPerUnit} USD · ${rate.asOf}`
                : t("Getting today's rate…", "Consultando el tipo de cambio…")}
            </span>
          </div>
          <div className="lp-fx-line">
            <span className="lp-fx-cur">USD</span>
            {rate ? (
              <CountUp
                className="lp-fx-big lp-fx-usd"
                to={Math.round(SAMPLE_BILL * rate.usdPerUnit)}
                format={(v) => formatUsd(Math.round(v))}
                duration={1.6}
              />
            ) : (
              <span className="lp-fx-big lp-fx-usd">US$—</span>
            )}
          </div>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-stack-title">
        <SectionHead
          kicker={t("How it holds together", "Cómo se sostiene")}
          id="lp-stack-title"
          title={t("Four pieces, one promise", "Cuatro piezas, una sola promesa")}
        />
        <div className="lp-grid">
          <article className="lp-cell lp-cell-main">
            <CellIcon><path d="M4 12.5l5 5L20 6.5" /></CellIcon>
            <span className="lp-cell-by">Hedera · Scheduled Transactions</span>
            <h3>{t("Nobody pays until the last yes", "Nadie paga hasta el último sí")}</h3>
            <p>
              {t(
                "Every payment of the bill is one transaction waiting on chain. It executes the moment the last person confirms — and if one person never does, no money moves for anyone.",
                "Todos los pagos de la cuenta son una sola transacción esperando en la cadena. Se ejecuta en cuanto confirma el último — y si alguien nunca confirma, no se mueve el dinero de nadie.",
              )}
            </p>
            <div className="lp-meter" aria-hidden="true">
              <span className="on" /><span className="on" /><span className="on" /><span />
            </div>
          </article>

          <article className="lp-cell">
            <CellIcon><path d="M4 7h16M4 12h10M4 17h6" /></CellIcon>
            <span className="lp-cell-by">x402 · Blocky402</span>
            <h3>{t("The engine charges per use", "El motor cobra por uso")}</h3>
            <p>
              {t("Each plan is bought over x402: a 402, a payment, the answer. No API key, no subscription — and the fee is sponsored.", "Cada plan se compra con x402: un 402, un pago, la respuesta. Sin llave de API ni suscripción — y la comisión va patrocinada.")}
            </p>
          </article>

          <article className="lp-cell">
            <CellIcon><><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M16 14.5h2" /></></CellIcon>
            <span className="lp-cell-by">Privy</span>
            <h3>{t("Get paid in your own wallet", "Cobra en tu propia cartera")}</h3>
            <p>
              {t("On a live bill, whoever paid can sign in with an email and receive the dollars in a wallet they own — no seed phrase, no crypto words.", "En una cuenta real, quien pagó puede entrar con su correo y recibir los dólares en una cartera suya — sin frases secretas ni palabras cripto.")}
            </p>
            <span className="lp-tag">{t("Live bills only · not in the sample trip", "Solo en cuentas reales · no en el viaje de ejemplo")}</span>
          </article>

          <article className="lp-cell">
            <CellIcon><><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" /></></CellIcon>
            <span className="lp-cell-by">World ID · Selfie Check</span>
            <h3>{t("One real person, one seat", "Una persona real, un lugar")}</h3>
            <p>
              {t("A live bill can ask for verified people: no fake guests, nobody holding two seats — and a lost seat comes back by verifying again.", "Una cuenta real puede pedir personas verificadas: sin invitados falsos ni alguien con dos lugares — y si pierdes tu lugar, lo recuperas verificándote otra vez.")}
            </p>
            <span className="lp-tag">{t("Demo: the World App step is simulated and labelled", "Demo: el paso de World App es simulado y está rotulado")}</span>
          </article>
        </div>
      </section>

      <section className="lp-section lp-engine" id="motor" aria-labelledby="lp-engine-title">
        <div className="lp-engine-copy">
          <SectionHead
            kicker={t("For a whole trip", "Para un viaje entero")}
            id="lp-engine-title"
            title={t("Squashed to the provable minimum", "Comprimido al mínimo demostrable")}
          />
          <div className="lp-engine-numbers">
            <div>
              <CountUp className="lp-n lp-n-owed" to={grossEdges.length} format={(v) => String(Math.round(v))} />
              <span className="lp-n-label">{t("crossed debts", "deudas cruzadas")}</span>
            </div>
            <svg width="28" height="16" viewBox="0 0 34 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 9h29M24 3l7 6-7 6" />
            </svg>
            <div>
              <CountUp className="lp-n lp-n-settled" from={grossEdges.length} to={transfers.length} format={(v) => String(Math.round(v))} duration={1.6} />
              <span className="lp-n-label">{t("payments", "pagos")}</span>
            </div>
          </div>
          <p className="lp-engine-cap">
            {t(
              `${grossEdges.length} crossed debts between ${people} friends become ${transfers.length} payments — ${Math.round(compression * 100)}% fewer. Not an estimate: the most disjoint groups that sum to zero, found exactly.`,
              `${grossEdges.length} deudas cruzadas entre ${people} amigos se vuelven ${transfers.length} pagos — ${Math.round(compression * 100)}% menos. No es un estimado: los grupos disjuntos que suman cero, encontrados exactamente.`,
            )}
          </p>
          <PressLink href="/join" className="lp-btn lp-btn-secondary">
            {t("Open the sample trip", "Abrir el viaje de ejemplo")}
            <Arrow />
          </PressLink>
        </div>
        <ReplayInView className="lp-engine-graph">
          <DebtGraph nodes={tripPeople(locale).map((p) => ({ id: p.id, initial: p.initial, name: p.name, isYou: p.isYou }))} grossEdges={grossEdges} transfers={transfers} />
        </ReplayInView>
      </section>

      <section className="lp-section" id="pruebas" aria-labelledby="lp-proofs-title">
        <SectionHead
          kicker={t("Check it yourself", "Compruébalo tú")}
          id="lp-proofs-title"
          title={t("Every claim opens on the chain", "Cada afirmación se abre en la cadena")}
          sub={t("What happens on chain opens on HashScan, Hedera's public testnet explorer — and the code is public.", "Lo que pasa en la cadena se abre en HashScan, el explorador público de la red de pruebas de Hedera — y el código es público.")}
        />
        <ul className="lp-proofs">
          <Proof href="https://hashscan.io/testnet/transaction/0.0.7162784-1789249485-560257425" kind={t("Transaction", "Transacción")} label={t("A plan paid over x402", "Un plan pagado con x402")} />
          <Proof href="https://hashscan.io/testnet/schedule/0.0.10510675" kind="Schedule" label={t("A bill settled on the last yes", "Una cuenta liquidada con el último sí")} />
          <Proof href="https://hashscan.io/testnet/transaction/0.0.10450391-1789253509-329841529" kind={t("Transaction", "Transacción")} label={t("US$88.40 moved in tUSD", "US$88.40 movidos en tUSD")} />
          <Proof href="https://hashscan.io/testnet/topic/0.0.10452145" kind="HCS" label={t("Proof of every run", "Prueba de cada cálculo")} />
          <Proof href={REPO_URL} kind="GitHub" label={t("The code", "El código")} />
        </ul>
      </section>

      <section className="lp-final">
        <div className="lp-final-inner">
          <LogoMark size={44} className="lp-final-mark" />
          <h2>{t("Is the bill already here?", "¿Ya llegó la cuenta?")}</h2>
          <p>{t("Open it, show the QR, and let the table say yes.", "Ábrela, enseña el QR y deja que la mesa diga que sí.")}</p>
          <div className="lp-cta">
            <PressLink href={primary.href} className="lp-btn lp-btn-invert">
              {primary.label}
              <Arrow />
            </PressLink>
            <PressLink href={secondary.href} className="lp-btn lp-btn-outline-invert">
              {secondary.label}
            </PressLink>
          </div>
          {offlineNote}
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-brand">
          <LogoMark size={24} />
          <Wordmark width={84} />
        </div>
        <p>
          {t(
            "Hedera testnet. The exchange rate, the charge for the plan and the settlement really happen; the people at the table settle from test accounts the app holds, and the dollars are test dollars.",
            "Red de pruebas de Hedera. El tipo de cambio, el cobro por el plan y la liquidación ocurren de verdad; la gente en la mesa liquida desde cuentas de prueba que tiene la app, y los dólares son de prueba.",
          )}
        </p>
        <span className="lp-foot-meta">Squash · ETHOnline 2026</span>
      </footer>
    </main>
  );
}

/**
 * The hero's picture: what a bill looks like at the table. Illustrative
 * numbers (an even split of the $2,500 sample dinner), labelled as such.
 */
function BillCard({ rate }: { rate: number | null }) {
  const { t } = useLocale();
  const share = SAMPLE_BILL / 4;
  const rows = [
    { name: t("You", "Tú"), initial: "T", state: "yes" as const, you: true },
    { name: "Rosa", initial: "R", state: "paid" as const },
    { name: "Mariana", initial: "M", state: "yes" as const },
    { name: "Diego", initial: "D", state: "wait" as const },
  ];
  return (
    <figure className="lp-bill" aria-label={t("Illustration of a bill at the table", "Ilustración de una cuenta en la mesa")}>
      <div className="lp-bill-head">
        <div>
          <span className="lp-bill-k">{t("Dinner · 4 people", "Cena · 4 personas")}</span>
          <strong className="lp-bill-total">{formatCents(SAMPLE_BILL)} <small>MXN</small></strong>
        </div>
        <span className="lp-bill-tag">{t("Example", "Ejemplo")}</span>
      </div>
      <ul className="lp-bill-rows">
        {rows.map((r) => (
          <li key={r.initial}>
            <span className={`lp-bill-av${r.you ? " you" : ""}`} aria-hidden="true">{r.initial}</span>
            <span className="lp-bill-name">{r.name}</span>
            <span className="lp-bill-amt">
              {formatCents(share)}
              {rate ? <small>{formatUsd(Math.round(share * rate))}</small> : null}
            </span>
            <span className={`lp-bill-state s-${r.state}`}>
              {r.state === "paid" && t("Paid", "Pagó")}
              {r.state === "yes" && (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>
                  {t("Yes", "Sí")}
                </>
              )}
              {r.state === "wait" && t("Waiting", "Falta")}
            </span>
          </li>
        ))}
      </ul>
      <div className="lp-bill-foot">
        <div className="lp-bill-meter" aria-hidden="true">
          <span className="on" /><span className="on" /><span className="on" /><span />
        </div>
        <span>{t("3 of 4 said yes · 1 scheduled transaction on Hedera", "3 de 4 dijeron que sí · 1 transacción programada en Hedera")}</span>
      </div>
      <figcaption>{t("Illustrative amounts. The sample trip runs the real flow on testnet.", "Montos ilustrativos. El viaje de ejemplo corre el flujo real en testnet.")}</figcaption>
    </figure>
  );
}

function SectionHead({ kicker, title, id, sub }: { kicker: string; title: string; id: string; sub?: string }) {
  return (
    <header className="lp-head">
      <span className="lp-kicker">{kicker}</span>
      <h2 id={id}>{title}</h2>
      {sub ? <p>{sub}</p> : null}
    </header>
  );
}

function Step({ n, title, body, icon }: { n: number; title: string; body: string; icon: React.ReactNode }) {
  return (
    <li className="lp-step">
      <div className="lp-step-top">
        <span className="lp-step-n">0{n}</span>
        <span className="lp-step-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        </span>
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </li>
  );
}

function Point({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li>
      <span className="lp-point-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

function CellIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="lp-cell-icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

function Proof({ href, kind, label }: { href: string; kind: string; label: string }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noreferrer">
        <span className="lp-proof-kind">{kind}</span>
        <span className="lp-proof-label">{label}</span>
        <Ext />
      </a>
    </li>
  );
}

function Arrow() {
  return (
    <svg className="lp-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Ext() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}
