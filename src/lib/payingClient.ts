import { createHash } from "node:crypto";
import { expandExpenses, net, type Expense, type Obligation } from "./netting";
import { quote } from "./pricing";

/**
 * The app as a paying customer of the engine.
 *
 * The browser must never do x402 — it holds no key and should not. So the app's
 * SERVER is the paying client: it calls the metered engine, settles the charge
 * from the app's own account, and folds that cost into whatever it charges its
 * users. That is how a real product would consume a metered API, and it is why
 * the live site can demonstrate the paid path instead of only a script.
 *
 * Two things keep a public demo from bleeding its balance:
 *   - identical graphs are answered from cache, so one distinct set of
 *     obligations costs one payment no matter how many people load the page
 *   - if payment cannot complete, the plan is still served, marked unpaid and
 *     with the reason. A judge sees the maths either way, and nothing pretends
 *     to have been paid for when it wasn't.
 */

export interface PaidPlan {
  paid: boolean;
  reason?: string;
  receipt?: string;
  payer?: string;
  [key: string]: unknown;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: PaidPlan }>();

function cacheKey(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

function agentConfigured(): boolean {
  return Boolean(process.env.AGENT_ACCOUNT_ID && process.env.AGENT_KEY);
}

type Caip2 = `${string}:${string}`;

async function buildFetch(network: Caip2): Promise<typeof fetch | null> {
  if (!agentConfigured()) return null;

  const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
  const { ExactHederaScheme, PrivateKey, createClientHederaSigner } = await import("@x402/hedera");

  const raw = String(process.env.AGENT_KEY).trim().replace(/^0x/, "");
  const declared = String(process.env.AGENT_KEY_TYPE ?? "").trim().toUpperCase();
  const key =
    declared === "ED25519"
      ? PrivateKey.fromStringED25519(raw)
      : declared === "ECDSA"
        ? PrivateKey.fromStringECDSA(raw)
        : PrivateKey.fromStringDer(raw);

  const signer = createClientHederaSigner(String(process.env.AGENT_ACCOUNT_ID), key);

  // The SDK's default spend controls only admit each chain's default asset,
  // which on Hedera is USDC. The engine prices in HBAR, so admit it rather
  // than switching the guardrail off wholesale.
  const client = new x402Client()
    .register(network, new ExactHederaScheme(signer))
    .setSpendControls({ allowedAssets: true });

  return wrapFetchWithPayment(fetch, client);
}

/**
 * Fetch a settlement plan from the metered engine, paying for it.
 *
 * @param engineUrl - absolute URL of the engine's /api/v1/net
 * @param body - the obligations or expenses to net
 */
export async function fetchPaidPlan(engineUrl: string, body: unknown): Promise<PaidPlan> {
  const key = cacheKey(body);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { ...hit.value, cached: true };
  }

  const network: Caip2 =
    process.env.HEDERA_NETWORK === "mainnet" ? "hedera:mainnet" : "hedera:testnet";

  const request = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  } satisfies RequestInit;

  const paying = await buildFetch(network);

  // No agent account configured: ask plainly and let the engine decide whether
  // it wants payment. If it does, we say so rather than faking a receipt.
  const doFetch = paying ?? fetch;

  let response: Response;
  try {
    response = await doFetch(engineUrl, request);
  } catch (e) {
    return localFallback(body, (e as Error).message);
  }

  if (response.status === 402) {
    return localFallback(body, "payment did not complete");
  }

  if (!response.ok) {
    throw new Error(`Engine responded ${response.status}`);
  }

  const value = (await response.json()) as PaidPlan;
  cache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * When payment cannot complete, compute the plan in-process instead.
 *
 * Deliberately NOT a second request to the engine with some bypass flag — a
 * bypass an unpaid caller could reach is not a gate at all. The engine stays
 * strict; the app just does the arithmetic itself for display, marks the
 * result unpaid, and carries no receipt. The settled screen already hides the
 * explorer link when there is no receipt, so nothing claims to have been paid.
 */
function localFallback(body: unknown, reason: string): PaidPlan {
  const payload = body as { obligations?: Obligation[]; expenses?: Expense[] };
  const obligations = Array.isArray(payload.expenses)
    ? expandExpenses(payload.expenses)
    : (payload.obligations ?? []);

  const result = net(obligations);

  return {
    balances: result.balances,
    grossEdges: result.grossEdges,
    transfers: result.transfers,
    optimal: result.optimal,
    compression: result.compression,
    price: quote(result.grossEdges.length),
    gated: true,
    paid: false,
    reason,
  };
}
