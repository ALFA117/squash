/**
 * How one bill is divided among the people at the table.
 *
 * All money is whole cents. The person who paid the bill still ate their own
 * share — they just fronted everyone else's — so their share stays with them
 * and everyone else owes them theirs.
 */

import type { Transfer } from "./netting";

export type SplitMode = "equal" | "custom" | "own";

export interface SplitMember {
  id: string;
  share_cents: number | null;
}

/**
 * Divide a total evenly. Cents that do not divide are handed out one at a
 * time to the first members, so the shares always add back to the exact
 * total — $2,500 among six is four people at $416.67 and two at $416.66.
 */
export function equalShares(totalCents: number, memberIds: string[]): Map<string, number> {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error("Total must be a whole, non-negative number of cents");
  }
  const n = memberIds.length;
  const out = new Map<string, number>();
  if (n === 0) return out;

  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  memberIds.forEach((id, i) => out.set(id, base + (i < remainder ? 1 : 0)));
  return out;
}

export interface ShareCheck {
  /** Every member has a share decided. */
  complete: boolean;
  /** Sum of the shares decided so far. */
  assigned: number;
  /** total − assigned. Positive: still to allocate. Negative: over-allocated. */
  gap: number;
  /** Complete, and adds up to the bill exactly. Only then can people confirm. */
  balanced: boolean;
}

export function checkShares(totalCents: number, members: SplitMember[]): ShareCheck {
  const decided = members.filter((m) => m.share_cents !== null);
  const assigned = decided.reduce((sum, m) => sum + (m.share_cents as number), 0);
  const complete = decided.length === members.length && members.length > 0;
  const gap = totalCents - assigned;
  return { complete, assigned, gap, balanced: complete && gap === 0 };
}

/**
 * Who pays whom. Everyone except the payer owes the payer their share; a
 * share of zero owes nothing. There is one creditor, so this is already the
 * minimum — the netting engine has nothing to compress here, and pretending
 * otherwise would be dishonest.
 */
export function transfersToPayer(payerId: string, members: SplitMember[]): Transfer[] {
  return members
    .filter((m) => m.id !== payerId && (m.share_cents ?? 0) > 0)
    .map((m) => ({ from: m.id, to: payerId, cents: m.share_cents as number }));
}

/** Parse "416.67", "2,500" or "2500" into whole cents. Null if not money. */
export function parseMoney(input: string): number | null {
  const clean = input.replace(/[\s,$]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
