import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sample trip",
  alternates: { canonical: "/join" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
