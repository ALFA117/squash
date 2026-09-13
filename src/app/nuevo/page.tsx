"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useLocale } from "@/components/Locale";
import { LogoMark } from "@/components/Logo";
import { PressButton } from "@/components/Press";
import { saveSession } from "@/lib/groupSession";
import { explain, fetchWithin } from "@/lib/http";
import { CURRENCIES, formatUsd, type Currency } from "@/lib/money";
import { parseMoney } from "@/lib/split";
import { useUsdRate } from "@/lib/useUsdRate";

/**
 * Start a bill.
 *
 * Whoever opens it paid the restaurant and becomes the admin: they decide how
 * it is split, and everyone else owes them their share.
 */
export default function NewBill() {
  const router = useRouter();
  const { t } = useLocale();

  const [name, setName] = useState("");
  const [what, setWhat] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("MXN");
  const rate = useUsdRate(currency);
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cents = parseMoney(amount);
  const ready = name.trim() && what.trim() && cents !== null && cents > 0 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetchWithin(
        "/api/groups",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ adminName: name, groupName: what, totalCents: cents, currency }),
        },
        20_000,
      );
      const data = (await res.json()) as {
        groupId?: string;
        memberId?: string;
        secret?: string;
        error?: string;
      };
      if (!res.ok || !data.groupId || !data.memberId || !data.secret) {
        throw new Error(data.error ?? t("Could not create the bill", "No se pudo crear la cuenta"));
      }
      saveSession(data.groupId, { memberId: data.memberId, secret: data.secret });
      router.push(`/g/${data.groupId}`);
    } catch (err) {
      setError(explain(err, t));
      setBusy(false);
    }
  }

  return (
    <main className="phone">
      <div className="screen-head">
        <Link href="/" className="back" aria-label={t("Back", "Volver")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="title">{t("Split a bill", "Dividir una cuenta")}</h1>
        <LogoMark size={34} badge className="head-mark" />
      </div>

      <form onSubmit={submit} className="bill-form">
        <p className="bill-lead">
          {t(
            "You paid. Tell us how much, then show the QR at the table — everyone scans in and sees their share.",
            "Tú pagaste. Di cuánto, y enseña el QR en la mesa — cada quien lo escanea y ve cuánto le toca.",
          )}
        </p>

        <label className="field">
          <span className="label">{t("YOUR NAME", "TU NOMBRE")}</span>
          <input
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoComplete="given-name"
            placeholder={t("Rosa", "Rosa")}
            required
          />
        </label>

        <label className="field">
          <span className="label">{t("WHAT FOR", "DE QUÉ ES")}</span>
          <input
            className="text-input"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            maxLength={60}
            placeholder={t("Friday dinner", "Cena del viernes")}
            required
          />
        </label>

        <div className="field">
          <span className="label" id="currency-label">{t("PAID IN", "PAGASTE EN")}</span>
          <div className="segmented" role="radiogroup" aria-labelledby="currency-label">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                className={currency === c ? "segment on" : "segment"}
                onClick={() => setCurrency(c)}
              >
                {currency === c && (
                  <motion.span
                    layoutId="currency-pill"
                    className="segment-pill"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="segment-text">
                  {c === "MXN" ? t("Pesos · MXN", "Pesos · MXN") : t("Dollars · USD", "Dólares · USD")}
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="label">{t("THE WHOLE BILL", "LA CUENTA COMPLETA")}</span>
          <div className="money-input">
            <span aria-hidden="true">$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="2,500.00"
              aria-describedby="amount-help"
              aria-invalid={amount !== "" && cents === null}
              required
            />
            <span className="money-unit">{currency}</span>
          </div>
          <span id="amount-help" className="field-help">
            {amount !== "" && cents === null
              ? t("That doesn't look like an amount — try 2500 or 2,500.00", "Eso no parece un monto — prueba 2500 o 2,500.00")
              : t("The full amount you paid, tip included.", "Todo lo que pagaste, propina incluida.")}
          </span>
          {currency === "MXN" && cents !== null && cents > 0 && (
            <span className="fx-estimate" aria-live="polite">
              {rate
                ? t(
                    `≈ ${formatUsd(Math.round(cents * rate.usdPerUnit))} today — it settles in dollars`,
                    `≈ ${formatUsd(Math.round(cents * rate.usdPerUnit))} hoy — se liquida en dólares`,
                  )
                : t("Getting today's dollar rate…", "Consultando el dólar de hoy…")}
            </span>
          )}
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="bill-actions">
          <PressButton type="submit" className="btn btn-dark" disabled={!ready}>
            {busy ? t("Creating…", "Creando…") : t("Create and get the QR", "Crear y obtener el QR")}
          </PressButton>
        </div>
      </form>
    </main>
  );
}
