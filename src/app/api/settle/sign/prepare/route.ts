import { NextResponse } from "next/server";
import { buildSignTransactionBytes } from "@/lib/scheduled";

export const runtime = "nodejs";

/**
 * GET /api/settle/sign/prepare — get the transaction bytes to sign.
 */
export async function POST(request: Request) {
  let body: { scheduleId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { scheduleId } = body;
  if (!scheduleId) {
    return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
  }

  try {
    const bytes = await buildSignTransactionBytes(scheduleId);
    return NextResponse.json({ bytes: Array.from(bytes) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
