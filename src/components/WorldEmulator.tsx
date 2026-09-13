"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "./Locale";

/**
 * A SIMULATION of the World App Selfie Check step — labelled as such on
 * screen — for while World has not enabled Selfie Check for this app.
 *
 * It opens the front camera inside a round frame, "scans", and returns a
 * simulated proof: a random identity kept on this device, which the server
 * turns into a per-table nullifier. The picture never leaves the phone and
 * is never stored; there is no face analysis. Everything the app does with
 * the result (one seat per person, verified-only tables, getting a seat
 * back) is real — only this step is pretend, and it says so.
 */

const SUBJECT_KEY = "squash:world-demo-subject";

function demoSubject(): string {
  try {
    const saved = localStorage.getItem(SUBJECT_KEY);
    if (saved && /^[a-f0-9]{64}$/.test(saved)) return saved;
  } catch {
    // storage blocked: a fresh identity for this visit
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    localStorage.setItem(SUBJECT_KEY, hex);
  } catch {
    // ignore
  }
  return hex;
}

type Step = "intro" | "scan" | "sending" | "done" | "error";

export default function WorldEmulator({
  open,
  onClose,
  onProof,
}: {
  open: boolean;
  onClose: () => void;
  onProof: (proof: { demo: true; subject: string }) => Promise<void>;
}) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("intro");
  const [camera, setCamera] = useState<"on" | "off" | "pending">("pending");
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      setStep("intro");
      setCamera("pending");
      setError(null);
    }
    return stopCamera;
  }, [open]);

  async function begin() {
    setStep("scan");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => {});
      }
      setCamera("on");
    } catch {
      setCamera("off"); // no camera or permission refused: the simulation goes on without it
    }
    setTimeout(async () => {
      stopCamera();
      setStep("sending");
      try {
        await onProof({ demo: true, subject: demoSubject() });
        setStep("done");
        setTimeout(onClose, 1100);
      } catch (e) {
        setError((e as Error).message);
        setStep("error");
      }
    }, 2600);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          onClick={step === "scan" || step === "sending" ? undefined : onClose}
        >
          <motion.div
            className="sheet world-sim"
            role="dialog"
            aria-modal="true"
            aria-labelledby="world-sim-title"
            initial={reduce ? false : { opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.14 } }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="world-sim-head">
              <span className="world-sim-logo" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
                </svg>
              </span>
              <strong id="world-sim-title">World App · Selfie Check</strong>
              <span className="demo-tag">{t("DEMO · SIMULATED", "DEMO · SIMULADO")}</span>
            </div>

            <div className={`world-sim-frame ${step}`}>
              <video ref={video} muted playsInline className={camera === "on" ? "on" : ""} />
              {camera !== "on" && (
                <svg className="world-sim-face" width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="8.6" r="4.1" />
                  <path d="M4.6 20.6c0-4 3.3-6.1 7.4-6.1s7.4 2.1 7.4 6.1" />
                </svg>
              )}
              {(step === "scan" || step === "sending") && <span className="world-sim-ring" aria-hidden="true" />}
              {step === "done" && (
                <span className="world-sim-ok" aria-hidden="true">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path className="draw-check" d="M4 12.5l5 5L20 6.5" />
                  </svg>
                </span>
              )}
            </div>

            <p className="sheet-note" aria-live="polite">
              {step === "intro" &&
                t(
                  "Look at the camera for a moment. This is a simulation of World App's Selfie Check: the picture never leaves your phone and is not stored.",
                  "Mira a la cámara un momento. Esto es una simulación del Selfie Check de World App: la imagen nunca sale de tu teléfono y no se guarda.",
                )}
              {step === "scan" && t("Checking that a real person is there…", "Comprobando que hay una persona real…")}
              {step === "sending" && t("Sending the (simulated) proof…", "Enviando la prueba (simulada)…")}
              {step === "done" && t("Verified (demo).", "Verificado (demo).")}
              {step === "error" && (error ?? t("It did not go through.", "No se pudo verificar."))}
            </p>

            <div className="sheet-actions">
              {step === "intro" || step === "error" ? (
                <>
                  <button type="button" className="btn btn-ghost" onClick={onClose}>
                    {t("Cancel", "Cancelar")}
                  </button>
                  <button type="button" className="btn btn-dark" onClick={begin} autoFocus>
                    {step === "error" ? t("Try again", "Reintentar") : t("Start", "Empezar")}
                  </button>
                </>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
