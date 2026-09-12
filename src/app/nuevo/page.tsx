"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/Locale";
import { saveSession } from "@/lib/groupSession";
import { parseMoney } from "@/lib/split";

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
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adminName: name, groupName: what, totalCents: cents }),
      });
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
      setError((err as Error).message);
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
            <span className="money-unit">MXN</span>
          </div>
          <span id="amount-help" className="field-help">
            {amount !== "" && cents === null
              ? t("That doesn't look like an amount — try 2500 or 2,500.00", "Eso no parece un monto — prueba 2500 o 2,500.00")
              : t("The full amount you paid, tip included.", "Todo lo que pagaste, propina incluida.")}
          </span>
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="bill-actions">
          <button type="submit" className="btn btn-settle" disabled={!ready}>
            {busy ? t("Creating…", "Creando…") : t("Create and get the QR", "Crear y obtener el QR")}
          </button>
        </div>
      </form>
    </main>
  );
}
