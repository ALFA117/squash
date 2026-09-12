import { NextResponse } from "next/server";
import { usdRate } from "@/lib/fx";
import { isCurrency } from "@/lib/money";

export const runtime = "nodejs";

/** GET /api/fx?currency=MXN — today's rate to US dollars, for showing an estimate. */
export async function GET(request: Request) {
  const currency = new URL(request.url).searchParams.get("currency") ?? "MXN";
  if (!isCurrency(currency)) {
    return NextResponse.json({ error: "currency must be MXN or USD" }, { status: 400 });
  }
  try {
    return NextResponse.json(await usdRate(currency), {
      headers: { "cache-control": "public, max-age=300" },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
