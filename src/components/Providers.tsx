"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { GroupProvider } from "./GroupProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Privy is used for sign-in only. With no App ID configured the app still
  // runs — every screen works without it — rather than failing to render.
  if (!appId) {
    return <GroupProvider>{children}</GroupProvider>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          accentColor: "#0b6b4f",
          theme: "#edefec",
          showWalletLoginFirst: false,
          logo: "/logo.svg",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <GroupProvider>
        {children}
      </GroupProvider>
    </PrivyProvider>
  );
}
