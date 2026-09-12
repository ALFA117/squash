import type { Metadata } from "next";
import "./globals.css";
import { LanguageToggle, LocaleProvider } from "@/components/Locale";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Squash — split the bill, nobody pays until everyone says yes",
  description:
    "Split a bill at the table by QR. Pesos convert to dollars at today's rate, and one Hedera transaction settles it only when everyone has confirmed.",
  openGraph: { images: ["/brand/logo.png"] },
};

export const viewport = { themeColor: "#f2f3f1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
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
            <LanguageToggle />
            {children}
          </LocaleProvider>
        </Providers>
      </body>
    </html>
  );
}
