"use client";
import Link from "next/link";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { formatCents, netExpenses } from "@/lib/netting";
import { VALLE_DE_BRAVO } from "@/lib/sample";
import { useLocale } from "@/components/Locale";
import { useGroup } from "@/components/GroupProvider";

/**
 * Joining a group.
 *
 * The credential check is not decoration: a netting set is only as honest as
 * its members. Someone who can invent counterparties can invent phantom debts
 * into the graph and walk away net positive. One person, one node.
 */
export default function JoinScreen() {
  const { login, authenticated, ready, user } = usePrivy();
  const { people, expenses: groupExpenses, syncUser } = useGroup();
  const router = useRouter();
  const others = VALLE_DE_BRAVO.people.filter((p) => !p.isYou);
  const { t } = useLocale();
  const userLabel = user?.email?.address || user?.phone?.number || user?.wallet?.address || null;
  const { balances } = netExpenses(groupExpenses);
  const currentUser = people.find((p) => p.id === "tu") ?? people[0];
  const yourBalance = currentUser ? balances[currentUser.id] ?? 0 : 0;
  const isOwed = yourBalance > 0;
  const totalSpent = groupExpenses.reduce((sum, expense) => sum + expense.cents, 0);

  useEffect(() => {
    if (ready && authenticated) {
      syncUser(user);
    }
  }, [ready, authenticated, user, syncUser]);

  const handleJoin = () => {
    if (authenticated) {
      router.push("/grupo");
    } else {
      login();
    }
  };

  return (
    <main className="phone" style={{ padding: "30px 26px 26px" }}>
      <div className="brand-row" aria-label="Squash brand">
        <img src="/brand/mark.webp" alt="Squash" className="brand-mark" width={32} height={32} />
        <div className="brand-copy">
          <span className="brand-name">Squash</span>
          <span className="brand-tag">shared expense settlement</span>
        </div>
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
        <Link href="/nuevo" className="demo-note">
          <span className="label">{t("THIS IS THE SAMPLE TRIP", "ESTE ES EL VIAJE DE EJEMPLO")}</span>
          <span>
            {t(
              "Want the real thing? Split a bill with your own table and get a QR everyone can scan.",
              "¿Lo quieres de verdad? Divide una cuenta con tu mesa y obtén un QR que todos puedan escanear.",
            )}
          </span>
        </Link>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
          <span className="label">{t("ROSA INVITED YOU TO", "ROSA TE INVITÓ A")}</span>
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
            {VALLE_DE_BRAVO.people.length} {t("people", "personas")} · {VALLE_DE_BRAVO.dates}
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
            {t("One person, one place in the group.", "Una persona, un lugar en el grupo.")}
          </span>
          <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--muted)", textWrap: "pretty" }}>
            {t(
              "We confirm it is you, so nobody can invent participants or add expenses that do not exist.",
              "Confirmamos que eres tú para que nadie pueda inventar participantes y meter gastos que no existen.",
            )}
          </span>
        </div>

        <div className="join-summary">
          <div className="join-summary-item">
            <span className="label">{t("GROUP TOTAL", "TOTAL DEL GRUPO")}</span>
            <strong>{formatCents(totalSpent)}</strong>
          </div>
          <div className="join-summary-item">
            <span className="label">{t("PARTICIPANTS", "PARTICIPANTES")}</span>
            <strong>{people.length}</strong>
          </div>
        </div>

        <div className="join-steps">
          <div className="join-step">
            <span>1</span>
            <small>{t("Enter with your identity", "Entra con tu identidad")}</small>
          </div>
          <div className="join-step">
            <span>2</span>
            <small>{t("See your share", "Ve tu cuota")}</small>
          </div>
          <div className="join-step">
            <span>3</span>
            <small>{t("Confirm and settle", "Confirma y liquida")}</small>
          </div>
        </div>

        {authenticated && (
          <div className="group-preview">
            <div className="group-preview-row">
              <span className="label">{t("IDENTITY VERIFIED", "IDENTIDAD VERIFICADA")}</span>
              <span className="preview-pill settled">{t("Ready", "Listo")}</span>
            </div>

            <div className="group-preview-grid">
              <div>
                <span className="label">{t("YOU", "TÚ")}</span>
                <strong>{currentUser?.name ?? t("Guest", "Invitado")}</strong>
              </div>
              <div>
                <span className="label">{t("AMOUNT", "MONTO")}</span>
                <strong>{formatCents(Math.abs(yourBalance))}</strong>
              </div>
            </div>

            <div className="group-preview-row compact">
              <span>{t("Split mode", "Modo de reparto")}</span>
              <span>{t("Equal by default", "Igual por defecto")}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <button onClick={handleJoin} className="btn btn-dark" disabled={!ready}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 9 }}>
            <path d="M3 8.5h3.2l1.6-2.4h8.4l1.6 2.4H21v10H3z" />
            <circle cx="12" cy="13" r="3.4" />
          </svg>
          {authenticated ? t("Continue with Squash", "Continuar con Squash") : t("Join with Privy", "Entrar con Privy")}
        </button>
        {authenticated && userLabel ? (
          <span style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center" }}>
            {t("Signed in as", "Conectado como")} {userLabel}
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("Your photo is never saved.", "La foto no se guarda en ningún lado.")}</span>
        )}
      </div>
    </main>
  );
}
