/**
 * Currencies, and the one conversion a bill goes through.
 *
 * A bill is written in the currency it was paid in — pesos at a restaurant in
 * Mexico, dollars elsewhere. What moves on chain is dollars (tUSD on testnet,
 * USDC on mainnet), so the shares are converted exactly once, at the moment
 * the admin asks everyone to confirm, at a rate that is then frozen on the
 * bill. Everyone confirms the dollar figure they will actually pay.
 */

import { formatCents } from "./netting";

export type Currency = "MXN" | "USD";
export const CURRENCIES: Currency[] = ["MXN", "USD"];

export function isCurrency(value: unknown): value is Currency {
  return value === "MXN" || value === "USD";
}

/** "$2,500.00 MXN" — the bill in its own currency, always labelled. */
export function formatMoney(cents: number, currency: Currency): string {
  return `${formatCents(cents)} ${currency}`;
}

/** "US$147.33" — what settles on chain. */
export function formatUsd(cents: number): string {
  return `US${formatCents(cents)}`;
}

/**
 * Convert shares to US cents so that they still add up.
 *
 * Rounding each share on its own can leave the dollar shares a cent away from
 * the dollar total. Instead the total is converted once, every share is
 * floored, and the cents left over go to the shares that lost the most in
 * rounding (ties to the earlier member). The result always sums to
 * round(total × rate), and no share moves by more than one cent.
 */
export function toUsdCents(
  shares: { id: string; cents: number }[],
  usdPerUnit: number,
): Map<string, number> {
  if (!(usdPerUnit > 0) || !Number.isFinite(usdPerUnit)) {
    throw new Error("Exchange rate must be a positive number");
  }
  for (const s of shares) {
    if (!Number.isInteger(s.cents) || s.cents < 0) {
      throw new Error("Shares must be whole, non-negative cents");
    }
  }

  const total = shares.reduce((a, s) => a + s.cents, 0);
  const usdTotal = Math.round(total * usdPerUnit);

  const exact = shares.map((s, i) => ({ id: s.id, i, raw: s.cents * usdPerUnit }));
  const floored = exact.map((e) => Math.floor(e.raw));
  let left = usdTotal - floored.reduce((a, c) => a + c, 0);

  const order = [...exact].sort((a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)) || a.i - b.i);
  for (const e of order) {
    if (left <= 0) break;
    floored[e.i] += 1;
    left -= 1;
  }

  return new Map(exact.map((e) => [e.id, floored[e.i]]));
}
