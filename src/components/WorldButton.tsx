"use client";

import { deviceLegacy, IDKitRequestWidget, selfieCheckLegacy, type IDKitResult, type RpContext } from "@worldcoin/idkit";
import { useState } from "react";
import { useLocale } from "./Locale";
import WorldEmulator from "./WorldEmulator";

// Demo mode: the World App step is simulated on screen, labelled as such.
const DEMO = process.env.NEXT_PUBLIC_WORLD_DEMO === "1";

/**
 * One button that runs World ID Selfie Check for this table's seat.
 *
 * The request is signed by our server (/api/world/context) for an action
 * scoped to the bill; the proof goes straight back to our server, which
 * checks it with the Developer Portal before anything is granted. The
 * widget never decides anything on its own.
 *
 * Loaded only when the button is on screen and World is configured.
 */
export default function WorldButton({
  groupId,
  label,
  onProof,
  disabled,
  className = "btn btn-ghost",
}: {
  groupId: string;
  label: string;
  /** Send the proof to the server; throw to make the widget show a failure. */
  onProof: (proof: IDKitResult) => Promise<void>;
  disabled?: boolean;
  className?: string;
}) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<{ app_id: `app_${string}`; action: string; rp_context: RpContext } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setError(null);
    if (DEMO) {
      setOpen(true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/world/context?group=${groupId}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.configured) throw new Error(t("World ID is not set up on this server.", "World ID no está configurado en este servidor."));
      setCtx({ app_id: data.app_id, action: data.action, rp_context: data.rp_context });
      setOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const env = (process.env.NEXT_PUBLIC_WORLD_ENV as "production" | "staging" | "sandbox") || "sandbox";
  // Selfie Check is the credential we ask for. While World has not enabled it
  // for this app, NEXT_PUBLIC_WORLD_CREDENTIAL=device falls back to World ID's
  // device credential — the same flow, available in the regular World App.
  const preset =
    process.env.NEXT_PUBLIC_WORLD_CREDENTIAL === "device"
      ? deviceLegacy({ signal: groupId })
      : selfieCheckLegacy({ signal: groupId });

  return (
    <>
      <button type="button" className={className} onClick={start} disabled={disabled || busy}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ marginRight: 8 }}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
        </svg>
        {busy ? t("Opening World ID…", "Abriendo World ID…") : label}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {DEMO && (
        <WorldEmulator
          open={open}
          onClose={() => setOpen(false)}
          onProof={async (proof) => {
            await onProof(proof as unknown as IDKitResult);
          }}
        />
      )}
      {!DEMO && ctx && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={ctx.app_id}
          action={ctx.action}
          rp_context={ctx.rp_context}
          allow_legacy_proofs={true}
          preset={preset}
          environment={env}
          language={locale === "es" ? "es" : "en"}
          handleVerify={async (result) => {
            await onProof(result);
          }}
          onSuccess={() => setOpen(false)}
          onError={(code) => setError(t(`World ID: ${code}`, `World ID: ${code}`))}
        />
      )}
    </>
  );
}
