import type { Currency } from "./money";

/**
 * How many US dollars one unit of a currency is worth, today.
 *
 * Two free, keyless sources that agree with each other; if both are down the
 * answer is an error, never a made-up rate. The rate is cached for ten
 * minutes, and frozen on a bill the moment confirmations start, so everyone
 * confirms the same dollar figure that then settles.
 */

export interface Rate {
  currency: Currency;
  usdPerUnit: number;
  /** The day the source published it. */
  asOf: string;
  source: string;
}

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<Currency, { rate: Rate; at: number }>();

async function fromOpenEr(currency: Currency): Promise<Rate> {
  const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`, { cache: "no-store" });
  const data = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
  const usd = data.rates?.USD;
  if (data.result !== "success" || !(usd! > 0)) throw new Error("open.er-api.com gave no USD rate");
  return {
    currency,
    usdPerUnit: usd!,
    asOf: new Date(data.time_last_update_utc ?? Date.now()).toISOString().slice(0, 10),
    source: "open.er-api.com",
  };
}

async function fromFrankfurter(currency: Currency): Promise<Rate> {
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${currency}&symbols=USD`, { cache: "no-store" });
  const data = (await res.json()) as { rates?: Record<string, number>; date?: string };
  const usd = data.rates?.USD;
  if (!(usd! > 0)) throw new Error("frankfurter gave no USD rate");
  return { currency, usdPerUnit: usd!, asOf: data.date ?? "", source: "frankfurter (ECB)" };
}

export async function usdRate(currency: Currency): Promise<Rate> {
  if (currency === "USD") {
    return { currency, usdPerUnit: 1, asOf: new Date().toISOString().slice(0, 10), source: "par" };
  }

  const hit = cache.get(currency);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rate;

  let rate: Rate;
  try {
    rate = await fromOpenEr(currency);
  } catch {
    try {
      rate = await fromFrankfurter(currency);
    } catch {
      throw new Error(`Could not get today's ${currency}→USD exchange rate. Nothing was charged; try again in a moment.`);
    }
  }
  cache.set(currency, { rate, at: Date.now() });
  return rate;
}
