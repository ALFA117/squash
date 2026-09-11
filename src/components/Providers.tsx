"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          accentColor: "#0b6b4f",
          theme: "#edefec",
          showWalletLoginFirst: false,
          logo: "/logo.svg", // Asumimos que hay un logo o se puede omitir
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        // Configuración para ocultar términos técnicos y usar español
        language: "es-ES",
      }}
    >
      {children}
    </PrivyProvider>
  );
}
