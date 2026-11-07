import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Waiting for everyone",
  alternates: { canonical: "/sign" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
