import { describe, expect, it } from "vitest";
import { LIMITS, validateExpenses } from "./validateExpenses";
import { VALLE_DE_BRAVO } from "./sample";

const one = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  label: "Cena",
  payer: "rosa",
  cents: 250_000,
  among: ["rosa", "diego"],
  ...over,
});

describe("validateExpenses", () => {
  it("accepts the sample trip unchanged", () => {
    const r = validateExpenses(VALLE_DE_BRAVO.expenses);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.expenses).toHaveLength(6);
  });

  it("rejects anything that is not a list", () => {
    expect(validateExpenses({}).ok).toBe(false);
    expect(validateExpenses(null).ok).toBe(false);
  });

  it("rejects an empty list", () => {
    expect(validateExpenses([]).ok).toBe(false);
  });

  it("rejects fractional cents — money is whole cents, never floats", () => {
    expect(validateExpenses([one({ cents: 2500.5 })]).ok).toBe(false);
  });

  it("rejects zero and negative amounts", () => {
    expect(validateExpenses([one({ cents: 0 })]).ok).toBe(false);
    expect(validateExpenses([one({ cents: -100 })]).ok).toBe(false);
  });

  it("caps a single expense so one request cannot move an absurd amount", () => {
    expect(validateExpenses([one({ cents: LIMITS.maxCents + 1 })]).ok).toBe(false);
    expect(validateExpenses([one({ cents: LIMITS.maxCents })]).ok).toBe(true);
  });

  it("caps the list, since every call spends the app's balance", () => {
    const many = Array.from({ length: LIMITS.expenses + 1 }, (_, i) => one({ id: `e${i}` }));
    expect(validateExpenses(many).ok).toBe(false);
  });

  it("caps the number of people in a group", () => {
    const crowd = Array.from({ length: LIMITS.people + 1 }, (_, i) => `p${i}`);
    expect(validateExpenses([one({ among: crowd })]).ok).toBe(false);
  });

  it("rejects an expense shared among nobody", () => {
    expect(validateExpenses([one({ among: [] })]).ok).toBe(false);
  });

  it("rejects a person listed twice in one split", () => {
    expect(validateExpenses([one({ among: ["rosa", "rosa"] })]).ok).toBe(false);
  });

  it("drops fields it does not know rather than passing them through", () => {
    const r = validateExpenses([one({ injected: "<script>" })]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.expenses[0]).not.toHaveProperty("injected");
  });
});
