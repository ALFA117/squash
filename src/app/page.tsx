"use client";

import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { netExpenses } from "@/lib/netting";
import { VALLE_DE_BRAVO } from "@/lib/sample";
import { useLocale } from "@/components/Locale";

/**
 * The front door.
 *
 * The numbers on this page are computed by the same solver the product runs,
 * not typed in — change the sample trip and the headline changes with it.
 */
export default function Landing() {
  const { t } = useLocale();
  const { grossEdges, transfers, compression } = netExpenses(VALLE_DE_BRAVO.expenses);
  const people = VALLE_DE_BRAVO.people.length;

  return (
    <main className="landing">
      <header className="lp-hero">
        <span className="lp-word">Squash</span>

        <h1>
          <code>git squash</code>, {t("but for money.", "pero para dinero.")}
        </h1>

        <p className="lp-lead">
          {t("Groups that share expenses end up owing everyone. Squash takes that tangle and compresses it to the", "Un grupo que comparte gastos termina debiéndose todos a todos. Squash toma esa maraña y la comprime al")} <strong>{t("fewest transfers possible", "mínimo de transferencias posible")}</strong> {t("— not something close, the provable minimum.", "— no a una cifra cercana, al mínimo demostrable.")}
        </p>

        <div className="lp-cta">
          <Link href="/join" className="btn btn-dark" style={{ width: "auto", padding: "0 26px" }}>
            {t("Enter the demo", "Entrar a la demo")}
          </Link>
          <a
            className="lp-link"
            href="https://github.com/ALFA117/squash"
            target="_blank"
            rel="noreferrer"
          >
            {t("View the code", "Ver el código")}
          </a>
        </div>
      </header>

      <Reveal>
<section className="lp-numbers" aria-label={t("The result", "El resultado")}>
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
          <span className="lp-cap">{t("transfers", "transferencias")} · {Math.round(compression * 100)}% {t("fewer fees", "menos comisiones")}</span>
        </div>
      </section>
</Reveal>

      <Reveal>
<section className="lp-section">
        <h2>{t("How it works", "Cómo funciona")}</h2>
        <ol className="lp-steps">
          <li>
            <strong>{t("Add the expenses.", "Anotan los gastos.")}</strong> {t("Who paid what, and who shares it. Cents that do not divide exactly are distributed one by one, so the shares always add up to the total.", "Quién puso qué, entre quiénes se divide. Los centavos que no dividen exacto se reparten uno por uno, así que las partes siempre suman el total.")}
          </li>
          <li>
            <strong>{t("The engine calculates the plan.", "El motor calcula el plan.")}</strong> {t("It turns", "Convierte las")} {grossEdges.length} {t("debts into", "deudas en")} {transfers.length} {t("transfers and leaves everyone at zero.", "transferencias y deja a todos en cero.")}
          </li>
          <li>
            <strong>{t("Everyone confirms, then it settles.", "Todos confirman, y se liquida.")}</strong> {t("If someone changes their mind, no money moves.", "Si alguien se arrepiente, no se mueve un peso.")}
          </li>
        </ol>
      </section>
</Reveal>

      <Reveal>
<section className="lp-section">
        <h2>{t("Why it is the minimum, not just a little less", "Por qué es el mínimo, no solo poquito")}</h2>
        <p>
          {t("Every settlement plan splits into groups that sum to zero, and a group of", "Todo plan de liquidación se descompone en grupos que suman cero, y un grupo de")} <em>k</em> {t("people costs", "personas cuesta")} <em>k−1</em> {t("transfers. So minimizing transfers means maximizing the number of disjoint groups that sum to zero. We solve that exactly.", "transferencias. Entonces minimizar transferencias es maximizar cuántos grupos disjuntos que sumen cero existen. Eso se resuelve exacto.")}
        </p>
        <p className="lp-muted">
          {t(`The usual fast method —the largest debtor pays the largest creditor, repeat— also solves this trip in ${transfers.length}, but it is not always right. The repo has a test where it chains three transfers when two are enough.`, `El método rápido de siempre —el más deudor le paga al más acreedor, repetir— también resuelve este viaje en ${transfers.length}, pero no siempre acierta. Hay una prueba en el repo con un caso donde encadena tres transferencias y bastaban dos.`)}
        </p>
      </section>
</Reveal>

      <Reveal>
<section className="lp-section">
        <h2>{t("The engine charges itself", "El motor se cobra solo")}</h2>
        <p>
          {t("Calculating the plan is not free, so the engine", "Calcular el plan no es gratis, así que el motor")} <strong>{t("charges per obligation", "cobra por obligación")}</strong> {t("— whoever brings a larger graph pays more. No API key, subscription, or account. You ask, a", "— quien trae un grafo más grande paga más. Sin llave de API, sin suscripción, sin cuenta. Se pide, llega un")} <code>402</code>{t(", you pay, and it goes through.", ", se paga, y pasa.")}
        </p>
        <p>
          {t("Whoever pays", "Quien paga")} <strong>{t("does not need the network token", "no necesita tener el token de la red")}</strong>{t(": the facilitator sponsors the fee. That is not a promise; it is on-chain.", ": el facilitador patrocina la comisión. Eso no es una promesa, está en la cadena.")}
        </p>
        <div className="lp-proof">
          <a
            href="https://hashscan.io/testnet/transaction/0.0.7162784-1789008230-889484170"
            target="_blank"
            rel="noreferrer"
          >
            {t("A real, paid request ↗", "Una petición pagada, de verdad ↗")}
          </a>
          <a
            href="https://hashscan.io/testnet/topic/0.0.10452145"
            target="_blank"
            rel="noreferrer"
          >
            {t("Proof of every run, published ↗", "La prueba de cada corrida, publicada ↗")}
          </a>
        </div>
        <p className="lp-muted">
          {t("Every calculation publishes the hash of its inputs and the plan it produced. Anyone can redo the calculation and verify that we did not cheat.", "Cada cálculo publica el hash de sus entradas y el plan que produjo. Cualquiera puede rehacer la cuenta y comprobar que no hicimos trampa.")}
        </p>
      </section>
</Reveal>

      <Reveal>
<section className="lp-section lp-faucet">
        <h2>{t("Want to try it with your group?", "¿Quieres probarlo con tu bola?")}</h2>
        <p>
          {t("All of this runs on the", "Todo esto corre en la")} <strong>{t("Hedera test network", "red de pruebas de Hedera")}</strong>{t(". The money is pretend and free — nobody uses real money or a card.", ". El dinero que se mueve es de mentiras y sale gratis — nadie pone un peso real, y no hay tarjeta de por medio.")}
        </p>
        <p>
          {t("So everyone can send and receive, each person needs their own test account. It takes two minutes:", "Para que cada quien pueda mandar y recibir, cada persona necesita su propia cuenta de pruebas. Se saca en dos minutos:")}
        </p>
        <div className="lp-faucet-links">
          <a className="lp-btn" href="https://portal.hedera.com/" target="_blank" rel="noreferrer">
            {t("Create a test account ↗", "Crear cuenta de pruebas ↗")}
            <span>1,000 ℏ cada 24 horas</span>
          </a>
          <a
            className="lp-btn"
            href="https://docs.hedera.com/evm/quickstart/get-test-hbar"
            target="_blank"
            rel="noreferrer"
          >
            {t("Anonymous faucet ↗", "Faucet anónimo ↗")}
            <span>{t("100 ℏ without signing up", "100 ℏ sin registrarte")}</span>
          </a>
        </div>
        <p className="lp-muted">
          {t("Never use a key from a wallet with real money. Create a new account just for this.", "Nunca uses una llave de una cartera con dinero real. Crea una cuenta nueva, solo para esto.")}
        </p>
      </section>
</Reveal>

      <Reveal>
<footer className="lp-foot">
        <p>
          <strong>{t("What is real and what is not, today.", "Qué es real y qué no, hoy.")}</strong> {t("The calculation, the charge for using it, and settlement between the six people really happen — all of it can be opened in the explorer. What remains a demo is that the six accounts are disposable and the app holds their keys; a product gives each person their own wallet.", "El cálculo, el cobro por usarlo y la liquidación entre las seis personas ocurren de verdad — todo eso se puede abrir en el explorador. Lo que sigue siendo demo es que las seis cuentas son desechables y la app tiene sus llaves; un producto le da a cada quien su propia cartera.")} {" "}
          <a href="https://github.com/ALFA117/squash/blob/main/STATUS.md" target="_blank" rel="noreferrer">
            {t("We track it here ↗", "Lo llevamos anotado ↗")}
          </a>
        </p>
        <p className="lp-muted">Squash · ETHOnline 2026 · Hedera testnet</p>
      </footer>
</Reveal>
    </main>
  );
}
