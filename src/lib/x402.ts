/**
 * x402 payment gate — Hedera `exact` scheme, settled through Blocky402.
 *
 * Shapes here are not guessed. They were taken from the authoritative
 * scheme spec (x402-foundation/x402, specs/schemes/exact/scheme_exact_hedera.md)
 * and checked against the live facilitator at api.testnet.blocky402.com,
 * whose validator rejects anything that does not match.
 *
 * The flow:
 *   1. caller asks for work with no payment      -> we answer 402 + `accepts`
 *   2. caller builds a Hedera transfer, signs it PARTIALLY, base64s it,
 *      and retries with X-PAYMENT
 *   3. we POST that to the facilitator's /verify, then /settle
 *   4. the facilitator co-signs as FEE PAYER and submits
 *
 * Step 4 is the part worth noticing: the facilitator sponsors the network fee,
 * so a caller can pay for the work without holding HBAR for gas.
 */

const FACILITATOR =
  process.env.X402_FACILITATOR_URL ?? "https://api.testnet.blocky402.com";

export const X402_VERSION = 2;
export const HEDERA_NETWORK = process.env.HEDERA_NETWORK === "mainnet" ? "hedera:mainnet" : "hedera:testnet";
/** 0.0.0 is HBAR itself; an HTS token would use its own id here. */
export const HBAR_ASSET = "0.0.0";

export interface PaymentRequirements {
  scheme: "exact";
  network: string;
  /** Tinybars, as a string. The facilitator rejects numbers. */
  amount: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: Record<string, unknown>;
}

export interface PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  /** { transaction: base64 partially-signed Hedera transaction } */
  payload: Record<string, unknown>;
}

export interface VerifyResult {
  isValid: boolean;
  invalidReason?: string | null;
  payer?: string;
}

export interface SettleResult {
  success: boolean;
  errorReason?: string | null;
  transaction?: string;
  network?: string;
  payer?: string;
}

export function isEnabled(): boolean {
  return process.env.X402_ENABLED === "true";
}

/** Who gets paid. Without this the gate cannot be armed. */
export function payTo(): string | null {
  return process.env.HEDERA_OPERATOR_ID || null;
}

/**
 * The account that sponsors the network fee. Read from the facilitator's
 * /supported at boot; falls back to the value it advertises today.
 */
let cachedFeePayer: string | null = null;

export async function feePayer(): Promise<string> {
  if (cachedFeePayer) return cachedFeePayer;

  try {
    const res = await fetch(`${FACILITATOR}/supported`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const body = (await res.json()) as {
        kinds?: Array<{ network?: string; extra?: { feePayer?: string } }>;
      };
      const kind = body.kinds?.find((k) => k.network === HEDERA_NETWORK);
      if (kind?.extra?.feePayer) {
        cachedFeePayer = kind.extra.feePayer;
        return cachedFeePayer;
      }
    }
  } catch {
    // fall through to the configured default
  }

  cachedFeePayer = process.env.X402_FEE_PAYER ?? "0.0.7162784";
  return cachedFeePayer;
}

export async function buildRequirements(args: {
  tinybars: number;
  resource: string;
  description: string;
}): Promise<PaymentRequirements> {
  const recipient = payTo();
  if (!recipient) throw new Error("HEDERA_OPERATOR_ID is not set");

  return {
    scheme: "exact",
    network: HEDERA_NETWORK,
    amount: String(args.tinybars),
    resource: args.resource,
    description: args.description,
    mimeType: "application/json",
    payTo: recipient,
    maxTimeoutSeconds: 180,
    asset: HBAR_ASSET,
    extra: { feePayer: await feePayer() },
  };
}

/** The body of a 402 answer. `accepts` is what the caller pays against. */
export function challenge(requirements: PaymentRequirements, error: string) {
  return {
    x402Version: X402_VERSION,
    error,
    accepts: [requirements],
  };
}

export function decodePaymentHeader(header: string | null): PaymentPayload | null {
  if (!header) return null;
  try {
    const json = Buffer.from(header, "base64").toString("utf8");
    const parsed = JSON.parse(json) as PaymentPayload;
    if (!parsed || typeof parsed !== "object" || !parsed.payload) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${FACILITATOR}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Facilitator ${path} returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const message =
      (parsed as { message?: string })?.message ?? `Facilitator ${path} failed (${res.status})`;
    throw new Error(message);
  }

  return parsed as T;
}

export function verify(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<VerifyResult> {
  return post<VerifyResult>("/verify", {
    x402Version: X402_VERSION,
    paymentPayload,
    paymentRequirements,
  });
}

export function settlePayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<SettleResult> {
  return post<SettleResult>("/settle", {
    x402Version: X402_VERSION,
    paymentPayload,
    paymentRequirements,
  });
}
