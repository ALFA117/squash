import { NextResponse } from "next/server";
import { accountMap, centsToTinybars, demoAccounts } from "@/lib/demoAccounts";
import { fetchPaidPlan } from "@/lib/payingClient";
import { VALLE_DE_BRAVO } from "@/lib/sample";
import { scheduleSettlement, scheduleStatus } from "@/lib/scheduled";
import type { Transfer } from "@/lib/netting";

export const runtime = "nodejs";

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
  try {
    const body = (await request.json()) as { nonce?: string };
    nonce = String(body.nonce ?? "").slice(0, 24);
  } catch {
    nonce = "";
  }
  if (!nonce) {
    return NextResponse.json({ error: "nonce is required" }, { status: 400 });
  }

  try {
    const engineUrl = new URL("/api/v1/net", request.url).toString();
    const plan = await fetchPaidPlan(engineUrl, { expenses: VALLE_DE_BRAVO.expenses });
    const transfers = plan.transfers as Transfer[];

    const schedule = await scheduleSettlement(transfers, accounts, centsToTinybars, nonce);

    return NextResponse.json({
      scheduleId: schedule.scheduleId,
      awaiting: schedule.awaiting,
      transfers,
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
