/**
 * The pool of testnet accounts that groups joined by QR draw from.
 *
 * Whoever creates a group takes slot 0; each person who scans in takes the
 * next free slot. Slots are shared across groups — every settlement is its
 * own transaction, so two groups on the same slot never collide.
 *
 * The app holds these keys. That is what lets it sign when a person taps
 * "confirm", and it is the part a production version replaces with a wallet
 * per person that the app never sees.
 */

export interface PoolAccount {
  accountId: string;
  keyType: "ECDSA" | "ED25519";
  key: string;
}

let cached: PoolAccount[] | null | undefined;

export function pool(): PoolAccount[] | null {
  if (cached !== undefined) return cached;
  const raw = process.env.POOL_ACCOUNTS_JSON;
  if (!raw) return (cached = null);
  try {
    const parsed = JSON.parse(raw) as PoolAccount[];
    cached = Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** How many people one group can hold — one pooled account each. */
export function poolSize(): number {
  return pool()?.length ?? 0;
}
