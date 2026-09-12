import { NextResponse } from "next/server";
import { fetchPaidPlan } from "@/lib/payingClient";
import { VALLE_DE_BRAVO } from "@/lib/sample";
import { validateExpenses } from "@/lib/validateExpenses";

export const runtime = "nodejs";

/**
 * The app's screens ask for a plan here.
 *
 * The app is a CUSTOMER of the netting engine, not the engine itself. This
 * route pays for the run over x402 and hands the browser the answer, so the
 * browser never touches a key. The engine at /api/v1/net stays strict: it has
 * no bypass.
 *
 * POST carries the group's own expenses. GET answers for the sample trip.
 * Both spend the app's balance, so input is bounded by validateExpenses and
 * identical requests are served from cache.
 */
async function answer(request: Request, expenses: unknown) {
  const checked = validateExpenses(expenses);
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }

  const engineUrl = new URL("/api/v1/net", request.url).toString();
  try {
    const plan = await fetchPaidPlan(engineUrl, { expenses: checked.expenses });
    return NextResponse.json(plan, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function GET(request: Request) {
  return answer(request, VALLE_DE_BRAVO.expenses);
}

export async function POST(request: Request) {
  let body: { expenses?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  return answer(request, body.expenses);
}
