import { describe, expect, it } from "vitest";
import { checkShares, equalShares, parseMoney, transfersToPayer } from "./split";

const six = ["rosa", "diego", "luis", "mariana", "ana", "tu"];

describe("equalShares", () => {
  it("splits the $2,500 dinner among six, to the cent", () => {
    const shares = equalShares(250_000, six);
    const values = [...shares.values()];
    expect(values).toEqual([41_667, 41_667, 41_667, 41_667, 41_666, 41_666]);
    expect(values.reduce((a, b) => a + b, 0)).toBe(250_000);
  });

  it("always adds back to the exact total, whatever the group size", () => {
    for (let n = 1; n <= 20; n++) {
      for (const total of [1, 99, 100, 250_000, 333_333, 10_000_000]) {
        const ids = Array.from({ length: n }, (_, i) => `p${i}`);
        const sum = [...equalShares(total, ids).values()].reduce((a, b) => a + b, 0);
        expect(sum).toBe(total);
      }
    }
  });

  it("never lets two shares differ by more than one cent", () => {
    const values = [...equalShares(100, ["a", "b", "c"]).values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it("refuses fractional cents", () => {
    expect(() => equalShares(10.5, ["a"])).toThrow();
  });

  it("returns nothing for an empty group rather than dividing by zero", () => {
    expect(equalShares(1000, []).size).toBe(0);
  });
});

describe("checkShares", () => {
  it("is balanced only when every share is set and they sum to the bill", () => {
    const members = [
      { id: "a", share_cents: 100_000 },
      { id: "b", share_cents: 150_000 },
    ];
    expect(checkShares(250_000, members)).toMatchObject({ complete: true, gap: 0, balanced: true });
  });

  it("reports how much is still unassigned", () => {
    const members = [
      { id: "a", share_cents: 100_000 },
      { id: "b", share_cents: 100_000 },
    ];
    expect(checkShares(250_000, members)).toMatchObject({ gap: 50_000, balanced: false });
  });

  it("reports over-allocation as a negative gap", () => {
    const members = [
      { id: "a", share_cents: 200_000 },
      { id: "b", share_cents: 100_000 },
    ];
    expect(checkShares(250_000, members)).toMatchObject({ gap: -50_000, balanced: false });
  });

  it("is not balanced while anyone has not decided, even if the sum happens to match", () => {
    const members = [
      { id: "a", share_cents: 250_000 },
      { id: "b", share_cents: null },
    ];
    expect(checkShares(250_000, members)).toMatchObject({ complete: false, balanced: false });
  });

  it("is not balanced for an empty group", () => {
    expect(checkShares(0, []).balanced).toBe(false);
  });
});

describe("transfersToPayer", () => {
  it("has everyone but the payer pay the payer their share", () => {
    const members = [
      { id: "rosa", share_cents: 41_667 },
      { id: "diego", share_cents: 41_667 },
      { id: "luis", share_cents: 41_666 },
    ];
    expect(transfersToPayer("rosa", members)).toEqual([
      { from: "diego", to: "rosa", cents: 41_667 },
      { from: "luis", to: "rosa", cents: 41_666 },
    ]);
  });

  it("leaves the payer's own share with the payer", () => {
    const t = transfersToPayer("rosa", [{ id: "rosa", share_cents: 99_999 }]);
    expect(t).toEqual([]);
  });

  it("skips anyone whose share is zero", () => {
    const t = transfersToPayer("rosa", [
      { id: "rosa", share_cents: 0 },
      { id: "diego", share_cents: 0 },
    ]);
    expect(t).toEqual([]);
  });
});

describe("parseMoney", () => {
  it("reads the ways people actually type an amount", () => {
    expect(parseMoney("416.67")).toBe(41_667);
    expect(parseMoney("2,500")).toBe(250_000);
    expect(parseMoney("2500")).toBe(250_000);
    expect(parseMoney("$2,500.5")).toBe(250_050);
  });

  it("refuses anything that is not money", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1.234")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
  });
});
