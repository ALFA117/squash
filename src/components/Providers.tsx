"use client";

import { GroupProvider } from "./GroupProvider";

/**
 * App-wide state. Privy used to wrap this for a sign-in on the sample trip;
 * it was removed because it held the demo hostage — the join button stayed
 * disabled until its wallet iframe loaded, then demanded an email code — and
 * it pulled WalletConnect and an embedded-wallet frame into every page. The
 * trip needs no identity: its six people are fixed testnet accounts.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <GroupProvider>{children}</GroupProvider>;
}
