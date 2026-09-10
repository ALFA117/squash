"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "en" | "es";

type LocaleContextValue = {
  locale: Locale;
  t: (english: string, spanish: string) => string;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const STORAGE_KEY = "squash-locale";

export function LocaleProvider({ children }: { children: ReactNode }) {
  // English is intentional: it is the public default for the submission.
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "es") setLocaleState("es");
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: (english, spanish) => locale === "es" ? spanish : english }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="language-toggle" role="group" aria-label="Language">
      <button type="button" className={locale === "en" ? "language-option active" : "language-option"} aria-pressed={locale === "en"} onClick={() => setLocale("en")}>
        EN
      </button>
      <button type="button" className={locale === "es" ? "language-option active" : "language-option"} aria-pressed={locale === "es"} onClick={() => setLocale("es")}>
        ES
      </button>
    </div>
  );
}
