import type { Metadata } from "next";

// A bill at the table: private to whoever holds the QR, so it is not indexed
// and has no canonical of its own.
export const metadata: Metadata = {
  title: "A bill at the table",
  alternates: { canonical: null },
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
