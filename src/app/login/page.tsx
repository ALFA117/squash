"use client";

import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/Logo";
import { PressLink } from "@/components/Press";
import { useLocale } from "@/components/Locale";

export default function LoginPage() {
  const { t } = useLocale();

  return (
    <main className="phone" style={{ padding: "26px 24px 24px" }}>
      <div className="brand-row">
        <LogoMark size={32} badge />
        <Wordmark width={100} />
      </div>

      <div className="join-trip">
        <span className="label">{t("LOGIN", "INICIO DE SESIÓN")}</span>
        <h1 className="join-title">{t("No separate login required", "No hace falta un login aparte")}</h1>
        <p className="join-sub">
          {t(
            "This demo remains open by design. Open the sample trip or start a bill instantly.",
            "Esta demo se mantiene abierta por diseño. Abre el viaje de ejemplo o empieza una cuenta al instante.",
          )}
        </p>

        <ol className="join-list">
          <li>
            <strong>{t("Sample trip", "Viaje de ejemplo")}</strong>{" "}
            {t("See the prebuilt table and how the engine reduces debts to the minimum.", "Mira la mesa preconstruida y cómo el motor reduce deudas al mínimo.")}
          </li>
          <li>
            <strong>{t("Split a bill", "Divide una cuenta")}</strong>{" "}
            {t("Create a real bill at the table and generate the QR for everyone to confirm.", "Crea una cuenta real en la mesa y genera el QR para que todos confirmen.")}
          </li>
          <li>
            <strong>{t("No wallet gate", "Sin bloqueo de cartera")}</strong>{" "}
            {t("The demo intentionally skips a sign-in flow so nobody gets stuck behind identity setup.", "La demo evita intencionalmente un flujo de acceso para que nadie se quede trabado en un proceso de identidad.")}
          </li>
        </ol>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <PressLink href="/join" className="btn btn-dark">
          {t("Open the sample trip", "Abrir el viaje de ejemplo")}
        </PressLink>
        <PressLink href="/nuevo" className="btn btn-ghost">
          {t("Start a bill", "Empezar una cuenta")}
        </PressLink>
        <Link href="/" className="join-alt">
          {t("Back to home →", "Volver al inicio →")}
        </Link>
      </div>
    </main>
  );
}
