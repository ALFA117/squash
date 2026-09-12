import type { Metadata } from "next";
import "./globals.css";
import { LanguageToggle, LocaleProvider } from "@/components/Locale";
import Providers from "@/components/Providers";
import { THEME_SCRIPT, ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Squash — split the bill, nobody pays until everyone says yes",
  description:
    "Split a bill at the table by QR. Pesos convert to dollars at today's rate, and one Hedera transaction settles it only when everyone has confirmed.",
  openGraph: { images: ["/brand/logo.png"] },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1319" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before first paint: pick light or dark so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <Providers>
          <LocaleProvider>
            <div className="top-controls">
              <ThemeToggle />
              <LanguageToggle />
            </div>
            {children}
          </LocaleProvider>
        </Providers>
      </body>
    </html>
  );
}
