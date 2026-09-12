import type { Expense } from "./netting";

/**
 * The single gate every client-supplied expense list passes through.
 *
 * Both /api/plan and /api/settle take expenses from the browser, and both
 * spend the app's own money: the first buys a netting run from the engine, the
 * second puts a transaction on chain. So the input is bounded here, once, and
 * the two routes cannot drift apart — the plan a person sees and the plan that
 * settles are computed from exactly the same validated list.
 */

export const LIMITS = {
  expenses: 50,
  people: 20,
  labelChars: 80,
  idChars: 40,
  /** $100,000.00 per expense. */
  maxCents: 10_000_000,
} as const;

export type Validated =
  | { ok: true; expenses: Expense[] }
  | { ok: false; error: string };

const isId = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= LIMITS.idChars;

export function validateExpenses(input: unknown): Validated {
  if (!Array.isArray(input)) {
    return { ok: false, error: "`expenses` must be an array" };
  }
  if (input.length === 0) {
    return { ok: false, error: "At least one expense is required" };
  }
  if (input.length > LIMITS.expenses) {
    return { ok: false, error: `At most ${LIMITS.expenses} expenses` };
  }

  const people = new Set<string>();
  const out: Expense[] = [];

  for (const [i, raw] of input.entries()) {
    const e = raw as Partial<Expense>;
    const where = `expense ${i + 1}`;

    if (!isId(e.id)) return { ok: false, error: `${where}: invalid id` };
    if (typeof e.label !== "string" || e.label.length > LIMITS.labelChars) {
      return { ok: false, error: `${where}: label must be text up to ${LIMITS.labelChars} characters` };
    }
    if (!isId(e.payer)) return { ok: false, error: `${where}: invalid payer` };
    if (!Number.isInteger(e.cents) || (e.cents as number) < 1 || (e.cents as number) > LIMITS.maxCents) {
      return { ok: false, error: `${where}: amount must be a whole number of cents, 1 to ${LIMITS.maxCents}` };
    }
    if (!Array.isArray(e.among) || e.among.length === 0 || !e.among.every(isId)) {
      return { ok: false, error: `${where}: must be shared among at least one person` };
    }
    if (new Set(e.among).size !== e.among.length) {
      return { ok: false, error: `${where}: a person is listed twice` };
    }

    people.add(e.payer);
    e.among.forEach((p) => people.add(p));

    out.push({
      id: e.id,
      label: e.label,
      payer: e.payer,
      cents: e.cents as number,
      among: [...e.among],
    });
  }

  if (people.size > LIMITS.people) {
    return { ok: false, error: `At most ${LIMITS.people} people in a group` };
  }

  return { ok: true, expenses: out };
}
