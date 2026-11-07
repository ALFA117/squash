"use client";

import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { useLocale } from "@/components/Locale";

/** The 404, in the reader's language, with the two ways that work. */
export function NotFoundBody() {
  const { t } = useLocale();
  return (
    <main className="phone">
      <div className="screen-head">
        <h1 className="title">{t("Page not found", "No encontramos esta página")}</h1>
        <LogoMark size={34} badge className="head-mark" />
      </div>
      <div className="room-pad">
        <p className="bill-lead">
          {t("There is nothing at this address.", "No hay nada en esta dirección.")}
        </p>
        <Link href="/" className="btn btn-dark">
          {t("Back to home", "Volver al inicio")}
        </Link>
        <Link href="/join" className="btn btn-ghost">
          {t("Open the sample trip", "Abrir el viaje de ejemplo")}
        </Link>
      </div>
    </main>
  );
}
