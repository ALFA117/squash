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
  let body: { scheduleId?: string; bytes?: string; signature?: string; publicKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  if (!body.scheduleId) {
    return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
  }

  if (!body.bytes) {
    return NextResponse.json({ error: "bytes is required" }, { status: 400 });
  }

  if (!body.signature) {
    return NextResponse.json({ error: "signature is required" }, { status: 400 });
  }

  if (!body.publicKey) {
    return NextResponse.json({ error: "publicKey is required" }, { status: 400 });
  }

  const { Transaction, Client, PublicKey } = await import("@hashgraph/sdk");

  const c = process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  c.setOperator(
    process.env.HEDERA_OPERATOR_ID!,
    await parseOperatorKey(process.env.HEDERA_OPERATOR_KEY),
  );

  try {
    const tx = Transaction.fromBytes(Buffer.from(body.bytes, "base64"));
    const signatureHex = body.signature.replace(/^0x/, "");
    const signatureBytes = Uint8Array.from(Buffer.from(signatureHex, "hex"));

    tx.addSignature(PublicKey.fromStringECDSA(body.publicKey), signatureBytes);

    const response = await tx.execute(c);
    await response.getReceipt(c);

    const status = await scheduleStatus(body.scheduleId);
    return NextResponse.json({ success: true, ...status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  } finally {
    c.close();
  }
}
