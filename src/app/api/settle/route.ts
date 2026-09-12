import { NextResponse } from "next/server";
import { accountMap, demoAccounts } from "@/lib/demoAccounts";
import { usdRate } from "@/lib/fx";
import { toUsdCents } from "@/lib/money";
import { fetchPaidPlan } from "@/lib/payingClient";
import { VALLE_DE_BRAVO } from "@/lib/sample";
import { validateExpenses } from "@/lib/validateExpenses";
import { scheduleSettlement, scheduleStatus } from "@/lib/scheduled";
import type { Transfer } from "@/lib/netting";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/settle — put the whole plan on chain as ONE pending transaction.
 *
 * Every debit and every credit go into a single transfer list, scheduled
 * rather than executed. It sits there until every debited account has signed;
 * the last signature makes it execute as a unit. Nobody pays until everybody
 * has — not because the app waits, but because the transaction cannot go
 * through until it is complete.
 */
export async function POST(request: Request) {
  const accounts = accountMap();
  if (!accounts) {
    return NextResponse.json(
      { error: "No demo accounts configured — run scripts/create-demo-accounts.mjs" },
      { status: 503 },
    );
  }

  let nonce: string;
  let expensesInput: unknown = VALLE_DE_BRAVO.expenses;
  try {
    const body = (await request.json()) as { nonce?: string; expenses?: unknown };
    nonce = String(body.nonce ?? "").slice(0, 24);
    // Settle exactly the expenses the person was shown the plan for. Without
    // this the screen could display one plan and put a different one on chain.
    if (body.expenses !== undefined) expensesInput = body.expenses;
  } catch {
    nonce = "";
  }
  if (!nonce) {
    return NextResponse.json({ error: "nonce is required" }, { status: 400 });
  }

  const checked = validateExpenses(expensesInput);
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }

  try {
    const engineUrl = new URL("/api/v1/net", request.url).toString();
    const plan = await fetchPaidPlan(engineUrl, { expenses: checked.expenses });
    const transfers = plan.transfers as Transfer[];

    // The trip is in pesos; what settles is dollars. Convert the plan once,
    // at today's rate, keeping its total exact.
    const rate = await usdRate("MXN");
    const usd = toUsdCents(
      transfers.map((t, i) => ({ id: String(i), cents: t.cents })),
      rate.usdPerUnit,
    );
    const usdTransfers = transfers
      .map((t, i) => ({ ...t, cents: usd.get(String(i)) ?? 0 }))
      .filter((t) => t.cents > 0);

    const schedule = await scheduleSettlement(usdTransfers, accounts, nonce);

    return NextResponse.json({
      scheduleId: schedule.scheduleId,
      awaiting: schedule.awaiting,
      transfers,
      usdTransfers,
      rate,
      accounts,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** GET /api/settle?scheduleId=… — has it executed yet? */
export async function GET(request: Request) {
  const scheduleId = new URL(request.url).searchParams.get("scheduleId");
  if (!scheduleId) {
    return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
  }

  if (!demoAccounts()) {
    return NextResponse.json({ error: "No demo accounts configured" }, { status: 503 });
  }

  try {
    return NextResponse.json({ scheduleId, ...(await scheduleStatus(scheduleId)) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
