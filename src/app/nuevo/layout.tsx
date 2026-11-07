import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Split a bill",
  description:
    "Open a bill, show the QR at the table, and settle it on Hedera testnet only when everyone says yes.",
  alternates: { canonical: "/nuevo" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
