import Link from "next/link";
import { netExpenses } from "@/lib/netting";
import { VALLE_DE_BRAVO } from "@/lib/sample";

export const metadata = {
  title: "Squash — git squash, pero para dinero",
  description:
    "Comprime las deudas cruzadas de un grupo al mínimo de transferencias posible, y cobra por usarlo.",
};

/**
 * The front door.
 *
 * The numbers on this page are computed by the same solver the product runs,
 * not typed in — change the sample trip and the headline changes with it.
 */
export default function Landing() {
  const { grossEdges, transfers, compression } = netExpenses(VALLE_DE_BRAVO.expenses);
  const people = VALLE_DE_BRAVO.people.length;

  return (
    <main className="landing">
      <header className="lp-hero">
        <span className="lp-word">Squash</span>

        <h1>
          <code>git squash</code>, pero para dinero.
        </h1>

        <p className="lp-lead">
          Un grupo que comparte gastos termina debiéndose todos a todos. Squash toma esa maraña
          y la comprime al <strong>mínimo de transferencias posible</strong> — no a una cifra
          cercana, al mínimo demostrable.
        </p>

        <div className="lp-cta">
          <Link href="/join" className="btn btn-dark" style={{ width: "auto", padding: "0 26px" }}>
            Entrar a la demo
          </Link>
          <a
            className="lp-link"
            href="https://github.com/ALFA117/squash"
            target="_blank"
            rel="noreferrer"
          >
            Ver el código
          </a>
        </div>
      </header>

      <section className="lp-numbers" aria-label="El resultado">
        <div>
          <span className="lp-n" style={{ color: "var(--owed)" }}>
            {grossEdges.length}
          </span>
          <span className="lp-cap">deudas cruzadas entre {people} personas</span>
        </div>
        <svg width="34" height="18" viewBox="0 0 34 18" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 9h29M24 3l7 6-7 6" />
        </svg>
        <div>
          <span className="lp-n" style={{ color: "var(--settled)" }}>
            {transfers.length}
          </span>
          <span className="lp-cap">transferencias · {Math.round(compression * 100)}% menos comisiones</span>
        </div>
      </section>

      <section className="lp-section">
        <h2>Cómo funciona</h2>
        <ol className="lp-steps">
          <li>
            <strong>Anotan los gastos.</strong> Quién puso qué, entre quiénes se divide. Los
            centavos que no dividen exacto se reparten uno por uno, así que las partes siempre
            suman el total.
          </li>
          <li>
            <strong>El motor calcula el plan.</strong> Convierte las {grossEdges.length} deudas
            en {transfers.length} transferencias y deja a todos en cero.
          </li>
          <li>
            <strong>Todos confirman, y se liquida.</strong> Si alguien se arrepiente, no se mueve
            un peso.
          </li>
        </ol>
      </section>

      <section className="lp-section">
        <h2>Por qué es el mínimo, no solo poquito</h2>
        <p>
          Todo plan de liquidación se descompone en grupos que suman cero, y un grupo de{" "}
          <em>k</em> personas cuesta <em>k−1</em> transferencias. Entonces minimizar transferencias
          es maximizar cuántos grupos disjuntos que sumen cero existen. Eso se resuelve exacto.
        </p>
        <p className="lp-muted">
          El método rápido de siempre —el más deudor le paga al más acreedor, repetir— también
          resuelve este viaje en {transfers.length}, pero no siempre acierta. Hay una prueba en el
          repo con un caso donde encadena tres transferencias y bastaban dos.
        </p>
      </section>

      <section className="lp-section">
        <h2>El motor se cobra solo</h2>
        <p>
          Calcular el plan no es gratis, así que el motor <strong>cobra por obligación</strong> —
          quien trae un grafo más grande paga más. Sin llave de API, sin suscripción, sin cuenta.
          Se pide, llega un <code>402</code>, se paga, y pasa.
        </p>
        <p>
          Quien paga <strong>no necesita tener el token de la red</strong>: el facilitador
          patrocina la comisión. Eso no es una promesa, está en la cadena.
        </p>
        <div className="lp-proof">
          <a
            href="https://hashscan.io/testnet/transaction/0.0.7162784-1789008230-889484170"
            target="_blank"
            rel="noreferrer"
          >
            Una petición pagada, de verdad ↗
          </a>
          <a
            href="https://hashscan.io/testnet/topic/0.0.10452145"
            target="_blank"
            rel="noreferrer"
          >
            La prueba de cada corrida, publicada ↗
          </a>
        </div>
        <p className="lp-muted">
          Cada cálculo publica el hash de sus entradas y el plan que produjo. Cualquiera puede
          rehacer la cuenta y comprobar que no hicimos trampa.
        </p>
      </section>

      <section className="lp-section lp-faucet">
        <h2>¿Quieres probarlo con tu bola?</h2>
        <p>
          Todo esto corre en la <strong>red de pruebas de Hedera</strong>. El dinero que se mueve
          es de mentiras y sale gratis — nadie pone un peso real, y no hay tarjeta de por medio.
        </p>
        <p>
          Para que cada quien pueda mandar y recibir, cada persona necesita su propia cuenta de
          pruebas. Se saca en dos minutos:
        </p>
        <div className="lp-faucet-links">
          <a className="lp-btn" href="https://portal.hedera.com/" target="_blank" rel="noreferrer">
            Crear cuenta de pruebas ↗
            <span>1,000 ℏ cada 24 horas</span>
          </a>
          <a
            className="lp-btn"
            href="https://docs.hedera.com/evm/quickstart/get-test-hbar"
            target="_blank"
            rel="noreferrer"
          >
            Faucet anónimo ↗
            <span>100 ℏ sin registrarte</span>
          </a>
        </div>
        <p className="lp-muted">
          Nunca uses una llave de una cartera con dinero real. Crea una cuenta nueva, solo para
          esto.
        </p>
      </section>

      <footer className="lp-foot">
        <p>
          <strong>Qué es real y qué no, hoy.</strong> El cálculo del plan es real y el cobro por
          usarlo también: esa transferencia de arriba ocurrió. La liquidación entre las personas
          del grupo todavía está en la demo — la pieza que la vuelve real, una sola transacción
          que no se ejecuta hasta que todos firmaron, está escrita y sin conectar.{" "}
          <a href="https://github.com/ALFA117/squash/blob/main/STATUS.md" target="_blank" rel="noreferrer">
            Lo llevamos anotado ↗
          </a>
        </p>
        <p className="lp-muted">Squash · ETHOnline 2026 · Hedera testnet</p>
      </footer>
    </main>
  );
}
