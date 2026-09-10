/**
 * Throwaway testnet accounts, one per person in the demo group.
 *
 * These exist so the settlement can move money between six DIFFERENT parties
 * instead of pretending to. The app holding everyone's key is a property of
 * the demo, not of the design — a real deployment gives each person their own
 * wallet and never sees the key. That is what the Privy work is for.
 *
 * Created by scripts/create-demo-accounts.mjs. The file is gitignored.
 */

export interface DemoAccount {
  accountId: string;
  keyType: "ECDSA" | "ED25519";
  key: string;
}

let cached: Record<string, DemoAccount> | null | undefined;

export function demoAccounts(): Record<string, DemoAccount> | null {
  if (cached !== undefined) return cached;

  // Read from the environment rather than the JSON file on disk: the working
  // directory a dev server is launched from is not reliably the app's own,
  // and Vercel cannot ship a gitignored file at all. One mechanism for both.
  const inline = process.env.DEMO_ACCOUNTS_JSON;
  if (!inline) {
    cached = null;
    return cached;
  }

  try {
    cached = JSON.parse(inline) as Record<string, DemoAccount>;
  } catch {
    cached = null;
  }

  return cached;
}

/** Person id -> Hedera account id, which is all the settlement needs. */
export function accountMap(): Record<string, string> | null {
  const accounts = demoAccounts();
  if (!accounts) return null;
  return Object.fromEntries(Object.entries(accounts).map(([id, a]) => [id, a.accountId]));
}

/**
 * The ledger is in cents; Hedera moves tinybars. One cent to one tinybar keeps
 * the demo cheap and the arithmetic legible — $2,040.00 settles as 0.00204 ℏ.
 * A real deployment would settle in a stablecoin at its own decimals.
 */
export function centsToTinybars(cents: number): number {
  return cents;
}
