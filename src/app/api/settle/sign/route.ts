import { NextResponse } from "next/server";
import { demoAccounts } from "@/lib/demoAccounts";
import { scheduleStatus, signSchedule } from "@/lib/scheduled";

export const runtime = "nodejs";

/**
 * POST /api/settle/sign — one person adds their signature.
 *
 * The last signature the scheduled transaction was waiting for triggers it,
 * so this route reports back whether the settlement has now executed.
 *
 * Signing on someone's behalf is only possible because these are throwaway
 * demo accounts whose keys the app holds. That is the part Privy replaces.
 */
export async function POST(request: Request) {
  const accounts = demoAccounts();
  if (!accounts) {
    return NextResponse.json({ error: "No demo accounts configured" }, { status: 503 });
  }

  let body: { scheduleId?: string; person?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { scheduleId, person } = body;
  if (!scheduleId || !person) {
    return NextResponse.json({ error: "scheduleId and person are required" }, { status: 400 });
  }

  const account = accounts[person];
  if (!account) {
    return NextResponse.json({ error: `No account for ${person}` }, { status: 404 });
  }

  try {
    await signSchedule(scheduleId, account.key, account.keyType);
    const status = await scheduleStatus(scheduleId);
    return NextResponse.json({ signed: person, scheduleId, ...status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
