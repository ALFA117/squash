import { describe, expect, it } from "vitest";
import { equalShares } from "./split";
import { formatMoney, formatUsd, isCurrency, toUsdCents } from "./money";

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("toUsdCents", () => {
  it("converts a peso bill to dollars and the shares add back to the dollar total", () => {
    // $2,500 MXN among three, at 0.058931 USD per peso
    const shares = [
      { id: "rosa", cents: 83_334 },
      { id: "diego", cents: 83_333 },
      { id: "luis", cents: 83_333 },
    ];
    const usd = toUsdCents(shares, 0.058931);
    expect(sum(usd)).toBe(Math.round(250_000 * 0.058931)); // 14,733 = US$147.33
  });

  it("moves no share by more than a cent from its exact value", () => {
    const rate = 0.058931;
    const shares = [...equalShares(1_000_001, ["a", "b", "c", "d", "e", "f", "g"])].map(([id, cents]) => ({ id, cents }));
    const usd = toUsdCents(shares, rate);
    for (const s of shares) {
      expect(Math.abs(usd.get(s.id)! - s.cents * rate)).toBeLessThan(1);
    }
  });

  it("holds the total for every group size and many rates", () => {
    for (const rate of [0.058931, 0.05, 1, 17.02, 0.0001234]) {
      for (let n = 1; n <= 20; n++) {
        const ids = Array.from({ length: n }, (_, i) => `p${i}`);
        const shares = [...equalShares(250_000 + n * 7, ids)].map(([id, cents]) => ({ id, cents }));
        const total = shares.reduce((a, s) => a + s.cents, 0);
        expect(sum(toUsdCents(shares, rate))).toBe(Math.round(total * rate));
      }
    }
  });

  it("is the identity for dollars", () => {
    const usd = toUsdCents([{ id: "a", cents: 12_345 }, { id: "b", cents: 1 }], 1);
    expect(usd.get("a")).toBe(12_345);
    expect(usd.get("b")).toBe(1);
  });

  it("refuses a missing or broken rate", () => {
    expect(() => toUsdCents([{ id: "a", cents: 100 }], 0)).toThrow();
    expect(() => toUsdCents([{ id: "a", cents: 100 }], Number.NaN)).toThrow();
    expect(() => toUsdCents([{ id: "a", cents: 1.5 }], 1)).toThrow();
  });
});

describe("labels", () => {
  it("always says which currency", () => {
    expect(formatMoney(250_000, "MXN")).toBe("$2,500.00 MXN");
    expect(formatUsd(14_733)).toBe("US$147.33");
    expect(isCurrency("MXN")).toBe(true);
    expect(isCurrency("EUR")).toBe(false);
  });
});
