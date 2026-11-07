import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settlement plan",
  alternates: { canonical: "/plan" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
