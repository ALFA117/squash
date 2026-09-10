/**
 * The wait is the interesting part, so say what is happening.
 *
 * The app is buying this answer: the engine charges per obligation and the
 * charge settles on Hedera before the plan comes back. Left as a bare
 * spinner that reads as a hang; said out loud it is the whole pitch.
 */
export function PayingNotice() {
  return (
    <div
      style={{
        padding: "0 22px",
        display: "flex",
        flexDirection: "column",
        gap: 7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span className="pulse-dot" aria-hidden="true" />
        <span style={{ fontSize: 15, fontWeight: 500 }}>Pagando el cálculo…</span>
      </div>
      <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, maxWidth: 300 }}>
        El motor cobra por obligación y el cargo se liquida antes de responder.
        Tarda unos segundos porque es una transacción real.
      </span>
    </div>
  );
}
