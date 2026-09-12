import { NextResponse } from "next/server";
import { expandExpenses, net, type Expense, type Obligation } from "@/lib/netting";
import { quote } from "@/lib/pricing";
import { publishProof } from "@/lib/hcs";
import {
  buildRequirements,
  challenge,
  challengeHeader,
  readPayment,
  isEnabled,
  payTo,
  settlePayment,
  verify,
} from "@/lib/x402";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/v1/net — the metered netting endpoint.
 *
 * Accepts either raw obligations or expenses to expand first:
 *   { "obligations": [{ "from": "a", "to": "b", "cents": 1000 }] }
 *   { "expenses":    [{ "id", "label", "payer", "cents", "among": [...] }] }
 *
 * Priced per obligation, not per request. With X402_ENABLED=true an unpaid
 * call is answered with 402 and the requirements in PAYMENT-REQUIRED; the
 * caller retries carrying PAYMENT-SIGNATURE, verified and settled through the Blocky402
 * facilitator before any work is done.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const payload = body as { obligations?: Obligation[]; expenses?: Expense[] };

  let obligations: Obligation[];
  try {
    if (Array.isArray(payload.expenses)) {
      obligations = expandExpenses(payload.expenses);
    } else if (Array.isArray(payload.obligations)) {
      obligations = payload.obligations;
    } else {
      return NextResponse.json(
        { error: "Provide either `obligations` or `expenses`" },
        { status: 400 },
      );
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  let result;
  try {
    result = net(obligations);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }

  // Price comes from the size of the graph the caller actually brought.
  const price = quote(result.grossEdges.length);
  const gated = isEnabled() && payTo() !== null && price.tinybars > 0;

  let paid = false;
  let receipt: string | undefined;
  let payer: string | undefined;

  const resourceInfo = { url: new URL(request.url).toString(), method: "POST" };

  if (gated) {
    const requirements = await buildRequirements({
      tinybars: price.tinybars,
      resource: new URL(request.url).toString(),
      description: `Netting run over ${price.obligations} obligations`,
    });

    const payment = await readPayment(request);

    if (!payment) {
      const body402 = await challenge(requirements, "Payment is required", resourceInfo);
      return NextResponse.json(body402, {
        status: 402,
        headers: await challengeHeader(body402),
      });
    }

    try {
      const verified = await verify(payment, requirements);
      if (!verified.isValid) {
        const body402 = await challenge(
          requirements,
          verified.invalidReason ?? "Payment did not verify",
          resourceInfo,
        );
        return NextResponse.json(body402, {
          status: 402,
          headers: await challengeHeader(body402),
        });
      }

      const settled = await settlePayment(payment, requirements);
      if (!settled.success) {
        const body402 = await challenge(
          requirements,
          settled.errorReason ?? "Settlement failed",
          resourceInfo,
        );
        return NextResponse.json(body402, {
          status: 402,
          headers: await challengeHeader(body402),
        });
      }

      paid = true;
      receipt = settled.transaction;
      payer = settled.payer ?? verified.payer;
    } catch (e) {
      // The facilitator is down or unreachable. Say so plainly instead of
      // handing out free work and pretending it was paid for.
      return NextResponse.json(
        { error: `Payment could not be processed: ${(e as Error).message}` },
        { status: 502 },
      );
    }
  }

  const proof = await publishProof(obligations, result);

  const headers: Record<string, string> = {
    "x402-network": process.env.HEDERA_NETWORK === "mainnet" ? "hedera:mainnet" : "hedera:testnet",
    "x402-unit-price": `${price.unitHbar} HBAR / obligation`,
    "x402-amount": `${price.hbar} HBAR`,
  };
  if (receipt) headers["x402-receipt"] = receipt;
  if (proof.topicId && proof.sequenceNumber) {
    headers["hcs-message"] = `${proof.topicId}/${proof.sequenceNumber}`;
  }

  return NextResponse.json(
    {
      balances: result.balances,
      grossEdges: result.grossEdges,
      transfers: result.transfers,
      optimal: result.optimal,
      compression: result.compression,
      price,
      paid,
      gated,
      payer,
      receipt,
      proof,
    },
    { headers },
  );
}
