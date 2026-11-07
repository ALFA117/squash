import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settlement",
  alternates: { canonical: "/done" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
