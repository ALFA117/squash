import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add an expense",
  alternates: { canonical: "/expense" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
