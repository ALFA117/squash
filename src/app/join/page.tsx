import Link from "next/link";
import { VALLE_DE_BRAVO } from "@/lib/sample";

/**
 * Joining a group.
 *
 * The credential check is not decoration: a netting set is only as honest as
 * its members. Someone who can invent counterparties can inject phantom debts
 * into the graph and walk away net positive. One person, one node.
 */
export default function JoinScreen() {
  const others = VALLE_DE_BRAVO.people.filter((p) => !p.isYou);

  return (
    <main className="phone" style={{ padding: "30px 26px 26px" }}>
      <div style={{ fontFamily: "var(--f-display)", fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em" }}>
        Squash
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          flexGrow: 1,
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
          <span className="label">ROSA TE INVITÓ A</span>
          <span
            style={{
              fontFamily: "var(--f-display)",
              fontSize: 31,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            {VALLE_DE_BRAVO.name}
          </span>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>
            {VALLE_DE_BRAVO.people.length} personas · {VALLE_DE_BRAVO.dates}
          </span>
        </div>

        <div style={{ display: "flex", gap: 7 }}>
          {others.map((p) => (
            <div className="avatar" key={p.id} style={{ width: 34, height: 34 }}>
              {p.initial}
            </div>
          ))}
          <div
            className="avatar"
            style={{ width: 34, height: 34, borderStyle: "dashed", borderColor: "#9aa69b" }}
          >
            +
          </div>
        </div>

        <div className="selfie-frame">
          <svg width="86" height="86" viewBox="0 0 24 24" fill="none" stroke="#8e9b8c" strokeWidth="1.1" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8.6" r="4.1" />
            <path d="M4.6 20.6c0-4 3.3-6.1 7.4-6.1s7.4 2.1 7.4 6.1" />
          </svg>
          <svg
            width="194"
            height="194"
            viewBox="0 0 194 194"
            fill="none"
            stroke="var(--settled)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ position: "absolute", top: 0, left: 0 }}
            aria-hidden="true"
          >
            <path d="M26 46 L26 32 Q26 26 32 26 L46 26" />
            <path d="M148 26 L162 26 Q168 26 168 32 L168 46" />
            <path d="M168 148 L168 162 Q168 168 162 168 L148 168" />
            <path d="M46 168 L32 168 Q26 168 26 162 L26 148" />
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, maxWidth: 300 }}>
          <span
            style={{
              fontFamily: "var(--f-display)",
              fontSize: 23,
              fontWeight: 600,
              lineHeight: 1.22,
              letterSpacing: "-0.015em",
              textWrap: "balance",
            }}
          >
            Una persona, un lugar en el grupo.
          </span>
          <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--muted)", textWrap: "pretty" }}>
            Confirmamos que eres tú para que nadie pueda inventar participantes y meter gastos que no
            existen.
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <Link href="/" className="btn btn-dark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 9 }}>
            <path d="M3 8.5h3.2l1.6-2.4h8.4l1.6 2.4H21v10H3z" />
            <circle cx="12" cy="13" r="3.4" />
          </svg>
          Tomar selfie
        </Link>
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>La foto no se guarda en ningún lado.</span>
      </div>
    </main>
  );
}
