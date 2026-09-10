/**
 * Metered pricing.
 *
 * The engine charges per OBLIGATION, not per request — a caller who brings a
 * bigger graph pays for the bigger graph. Amounts are tinybars (1 HBAR =
 * 100,000,000 tinybars) so nothing here touches a float.
 */

export const TINYBARS_PER_HBAR = 100_000_000;

interface Tier {
  upTo: number; // inclusive obligation count
  tinybarsEach: number;
}

const TIERS: Tier[] = [
  { upTo: 10, tinybarsEach: 40_000 }, // 0.00040 HBAR
  { upTo: 50, tinybarsEach: 35_000 }, // 0.00035 HBAR
  { upTo: 200, tinybarsEach: 28_000 }, // 0.00028 HBAR
  { upTo: Infinity, tinybarsEach: 21_000 }, // 0.00021 HBAR
];

export interface Quote {
  obligations: number;
  tinybarsEach: number;
  tinybars: number;
  hbar: string;
  unitHbar: string;
}

export function quote(obligations: number): Quote {
  if (!Number.isInteger(obligations) || obligations < 0) {
    throw new Error("Obligation count must be a non-negative integer");
  }

  const tier = TIERS.find((t) => obligations <= t.upTo) ?? TIERS[TIERS.length - 1];
  const tinybars = obligations * tier.tinybarsEach;

  return {
    obligations,
    tinybarsEach: tier.tinybarsEach,
    tinybars,
    hbar: formatHbar(tinybars),
    unitHbar: formatHbar(tier.tinybarsEach),
  };
}

export function formatHbar(tinybars: number): string {
  const whole = Math.floor(tinybars / TINYBARS_PER_HBAR);
  const frac = String(tinybars % TINYBARS_PER_HBAR)
    .padStart(8, "0")
    .replace(/0+$/, "")
    .padEnd(5, "0");
  return `${whole}.${frac}`;
}
