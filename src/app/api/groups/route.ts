import { NextResponse } from "next/server";
import { createGroup, DB_OFFLINE, GroupError, isDbUnreachable } from "@/lib/groups";

export const runtime = "nodejs";
export const maxDuration = 60;

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
