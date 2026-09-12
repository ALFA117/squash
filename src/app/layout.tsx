import type { Metadata } from "next";
import "./globals.css";
import { LanguageToggle, LocaleProvider } from "@/components/Locale";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Squash",
  description: "git squash, but for money — multilateral netting, settled in one shot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/logo.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <Providers>
          <LocaleProvider>
            <LanguageToggle />
            {children}
          </LocaleProvider>
        </Providers>
      </body>
    </html>
  );
}
