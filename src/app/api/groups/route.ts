import { NextResponse } from "next/server";
import { createGroup, DB_OFFLINE, GroupError, isDbUnreachable, liveBillsReachable } from "@/lib/groups";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/groups — are live bills available? Answers { live } so the screens
 * can warn up front when the bill database cannot be reached. Cached briefly
 * at the edge: it is a status light, not a per-request query.
 */
export async function GET() {
  const live = await liveBillsReachable();
  return NextResponse.json(live ? { live } : { live, error: DB_OFFLINE }, {
    headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=120" },
  });
}

/** POST /api/groups — start a bill. Whoever creates it paid it, and is admin. */
export async function POST(request: Request) {
  let body: { adminName?: unknown; groupName?: unknown; totalCents?: unknown; currency?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  try {
    const created = await createGroup(body);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (isDbUnreachable(e)) return NextResponse.json({ error: DB_OFFLINE }, { status: 503 });
    const status = e instanceof GroupError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
