import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Valle de Bravo · sample trip",
  description:
    "Six friends, fifteen crossed debts: see the sample trip squashed to three payments on Hedera testnet.",
  alternates: { canonical: "/grupo" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
