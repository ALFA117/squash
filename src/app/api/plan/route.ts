import { NextResponse } from "next/server";
import { fetchPaidPlan } from "@/lib/payingClient";
import { VALLE_DE_BRAVO } from "@/lib/sample";

export const runtime = "nodejs";

/**
 * GET /api/plan — what the app's screens call.
 *
 * The app is a CUSTOMER of the netting engine, not the engine itself. This
 * route pays for the run over x402 and hands the browser the answer, so the
 * browser never touches a key and the live site still demonstrates the paid
 * path. The engine at /api/v1/net stays strict: it has no bypass.
 */
export async function GET(request: Request) {
  const engineUrl = new URL("/api/v1/net", request.url).toString();

  try {
    const plan = await fetchPaidPlan(engineUrl, { expenses: VALLE_DE_BRAVO.expenses });
    return NextResponse.json(plan, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
