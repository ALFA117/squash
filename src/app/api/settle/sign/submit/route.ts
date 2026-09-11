import { NextResponse } from "next/server";
import { parseOperatorKey } from "@/lib/hederaKey";
import { scheduleStatus } from "@/lib/scheduled";

export const runtime = "nodejs";

/**
 * POST /api/settle/sign/submit
 *
 * Receives a signed transaction (as bytes) and executes it.
 */
export async function POST(request: Request) {
  let body: { bytes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  if (!body.bytes) {
    return NextResponse.json({ error: "bytes is required" }, { status: 400 });
  }

  const { Transaction, Client } = await import("@hashgraph/sdk");
  
  const c = process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  c.setOperator(
    process.env.HEDERA_OPERATOR_ID!,
    await parseOperatorKey(process.env.HEDERA_OPERATOR_KEY),
  );

  try {
    const tx = Transaction.fromBytes(Buffer.from(body.bytes, "base64"));
    const response = await tx.execute(c);
    const receipt = await response.getReceipt(c);
    
    // We need the scheduleId to check the status. 
    // Usually it's in the transaction itself if we parsed it.
    // For ScheduleSignTransaction, we can get the status if we know the ID.
    // Since this is a generic submit, we'll just report success.
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  } finally {
    c.close();
  }
}
