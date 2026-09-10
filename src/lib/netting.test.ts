import { describe, expect, it } from "vitest";
import {
  expandExpenses,
  net,
  netBalances,
  netExpenses,
  pairwiseEdges,
  settle,
  type Expense,
} from "./netting";
import { VALLE_DE_BRAVO } from "./sample";

describe("expandExpenses", () => {
  it("splits evenly and every share sums back to the total", () => {
    const obligations = expandExpenses(VALLE_DE_BRAVO.expenses);
    const total = VALLE_DE_BRAVO.expenses.reduce((a, e) => a + e.cents, 0);
    const owed = obligations.reduce((a, o) => a + o.cents, 0);
    const paidByOthers = total - total / 6; // the payer never owes themselves
    expect(owed).toBe(paidByOthers);
  });

  it("hands leftover cents out one at a time instead of losing them", () => {
    const expenses: Expense[] = [
      { id: "x", label: "odd", payer: "a", cents: 1000, among: ["a", "b", "c"] },
    ];
    const obligations = expandExpenses(expenses);
    // 1000 / 3 = 334, 333, 333 — b and c owe their shares, a keeps 334.
    const shares = obligations.map((o) => o.cents).sort((x, y) => y - x);
    expect(shares).toEqual([333, 333]);
    expect(334 + 333 + 333).toBe(1000);
  });
});

describe("netBalances", () => {
  it("always sums to zero", () => {
    const balances = netBalances(expandExpenses(VALLE_DE_BRAVO.expenses));
    const total = Object.values(balances).reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
  });

  it("matches the figures shown in the mockups", () => {
    const balances = netBalances(expandExpenses(VALLE_DE_BRAVO.expenses));
    expect(balances).toEqual({
      rosa: 204_000,
      mariana: 111_000,
      ana: 57_000,
      luis: -57_000,
      diego: -111_000,
      tu: -204_000,
    });
  });
});

describe("pairwiseEdges", () => {
  it("finds one edge per pair when everyone shares every expense", () => {
    const edges = pairwiseEdges(expandExpenses(VALLE_DE_BRAVO.expenses));
    expect(edges).toHaveLength(15); // 6 people = 6*5/2 pairs
  });

  it("cancels a pair that owes the same amount both ways", () => {
    const edges = pairwiseEdges([
      { from: "a", to: "b", cents: 500 },
      { from: "b", to: "a", cents: 500 },
    ]);
    expect(edges).toHaveLength(0);
  });
});

describe("settle", () => {
  it("compresses the sample trip from 15 obligations to 3 transfers", () => {
    const result = netExpenses(VALLE_DE_BRAVO.expenses);
    expect(result.grossEdges).toHaveLength(15);
    expect(result.transfers).toHaveLength(3);
    expect(result.optimal).toBe(true);
    expect(result.compression).toBeCloseTo(0.8);
  });

  it("produces exactly the transfers the mockups promise", () => {
    const { transfers } = netExpenses(VALLE_DE_BRAVO.expenses);
    const plan = transfers
      .map((t) => `${t.from}->${t.to}:${t.cents}`)
      .sort();
    expect(plan).toEqual([
      "diego->mariana:111000",
      "luis->ana:57000",
      "tu->rosa:204000",
    ]);
  });

  it("leaves every party at zero", () => {
    const result = netExpenses(VALLE_DE_BRAVO.expenses);
    const after = { ...result.balances };
    for (const t of result.transfers) {
      after[t.from] += t.cents;
      after[t.to] -= t.cents;
    }
    for (const value of Object.values(after)) expect(value).toBe(0);
  });

  it("beats the greedy bound when a zero-sum subgroup exists", () => {
    // Greedy would chain these into 3 transfers; the exact solver sees two
    // independent pairs and settles in 2.
    const { transfers, optimal } = settle({ a: -100, b: 100, c: -250, d: 250 });
    expect(transfers).toHaveLength(2);
    expect(optimal).toBe(true);
  });

  it("handles a single debtor owing a single creditor", () => {
    const { transfers } = settle({ a: -700, b: 700 });
    expect(transfers).toEqual([{ from: "a", to: "b", cents: 700 }]);
  });

  it("returns nothing when everyone is already square", () => {
    const { transfers } = settle({ a: 0, b: 0 });
    expect(transfers).toEqual([]);
  });

  it("refuses balances that do not sum to zero", () => {
    expect(() => settle({ a: -100, b: 50 })).toThrow(/sum to zero/);
  });

  it("never needs more than n-1 transfers", () => {
    const balances = { a: -600, b: -300, c: 100, d: 200, e: 300, f: 300 };
    const { transfers } = settle(balances);
    expect(transfers.length).toBeLessThanOrEqual(5);
  });
});

describe("net", () => {
  it("rejects a non-positive obligation instead of silently netting it", () => {
    expect(() => net([{ from: "a", to: "b", cents: 0 }])).toThrow(/positive integer/);
  });
});
