import { NextResponse } from "next/server";
import { DB_OFFLINE, getGroup, GroupError, isDbUnreachable } from "@/lib/groups";
import { rpContext, seatAction, worldConfigured } from "@/lib/world";

export const runtime = "nodejs";

/**
 * GET /api/world/context?group=<id> — a signed World ID request for this
 * table's seat action. Signing happens here so the key never leaves the
 * server; the widget carries the signature to World App.
 */
export async function GET(request: Request) {
  if (!worldConfigured()) return NextResponse.json({ configured: false }, { status: 200 });
  const group = new URL(request.url).searchParams.get("group") ?? "";
  if (!/^[a-z0-9]{6,12}$/.test(group)) return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  // Only sign requests for a table that exists.
  try {
    await getGroup(group);
  } catch (e) {
    if (isDbUnreachable(e)) return NextResponse.json({ error: DB_OFFLINE }, { status: 503 });
    const status = e instanceof GroupError ? e.status : 500;
    return NextResponse.json({ error: status === 404 ? "Unknown table" : (e as Error).message }, { status });
  }
  const action = seatAction(group);
  return NextResponse.json(
    { configured: true, app_id: process.env.NEXT_PUBLIC_WORLD_APP_ID, action, rp_context: rpContext(action) },
    { headers: { "cache-control": "no-store" } },
  );
}
