import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./app.css";
import { LanguageToggle, LocaleProvider } from "@/components/Locale";
import Providers from "@/components/Providers";
import { THEME_SCRIPT, ThemeToggle } from "@/components/ThemeToggle";

const SITE = "https://squash-pay.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  alternates: { canonical: "/" },
  title: {
    default: "Squash — split the bill, nobody pays until everyone says yes",
    template: "%s · Squash",
  },
  description:
    "Split a bill at the table by QR. Pesos convert to dollars at today's rate, and one Hedera transaction settles it only when everyone has confirmed.",
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Squash",
    title: "Squash — nobody pays until everyone says yes",
    description:
      "Split a bill at the table by QR. One Hedera testnet transaction settles it only when everyone has confirmed.",
    images: [{ url: "/brand/logo.png", alt: "Squash" }],
  },
  twitter: {
    card: "summary",
    title: "Squash — nobody pays until everyone says yes",
    description: "Split a bill at the table by QR. One Hedera testnet transaction settles it on the last yes.",
    images: ["/brand/logo.png"],
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f11" },
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
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <LocaleProvider>
          <Providers>
            <div className="top-controls">
              <ThemeToggle />
              <LanguageToggle />
            </div>
            {children}
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
