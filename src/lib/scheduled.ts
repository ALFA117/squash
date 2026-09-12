import { parseOperatorKey } from "./hederaKey";
import type { Transfer } from "./netting";

/**
 * Atomic settlement via Hedera Scheduled Transactions.
 *
 * This is the reason the project is on Hedera rather than anywhere else.
 *
 * The whole settlement plan becomes ONE transfer transaction — every debit and
 * every credit in a single transfer list — scheduled rather than executed. It
 * sits pending until every account being debited has signed. The moment the
 * last signature lands it executes as a unit; until then, nothing moves. So
 * "nobody pays until everybody has confirmed" is not a promise the app makes,
 * it is a property of the transaction.
 *
 * Driven by /api/settle and /api/settle/sign, against one funded testnet
 * account per person (scripts/create-demo-accounts.mjs).
 */

export interface ScheduleHandles {
  scheduleId: string;
  /** Accounts that still have to sign before it executes. */
  awaiting: string[];
  expirationTime?: string;
}

export interface AccountMap {
  /** app user id -> Hedera account id, e.g. { tu: "0.0.1234" } */
  [personId: string]: string;
}

function configured(): boolean {
  return Boolean(process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY);
}

async function client() {
  const { Client } = await import("@hashgraph/sdk");
  const c = process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  c.setOperator(
    process.env.HEDERA_OPERATOR_ID!,
    await parseOperatorKey(process.env.HEDERA_OPERATOR_KEY),
  );
  return c;
}

/**
 * The dollar that settles: an HTS token with two decimals, so one unit is one
 * US cent. tUSD on testnet (scripts/create-dollar-token.mjs); on mainnet the
 * same id slot takes USDC. Without it there is nothing honest to settle in.
 */
export function settlementToken(): string {
  const id = process.env.SETTLEMENT_TOKEN_ID?.trim();
  if (!id) throw new Error("SETTLEMENT_TOKEN_ID is not set — run scripts/create-dollar-token.mjs");
  return id;
}

const MIRROR =
  process.env.HEDERA_NETWORK === "mainnet"
    ? "https://mainnet.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";

/** Test dollars an account holds, per the mirror node (a few seconds behind). */
async function tokenBalance(accountId: string, tokenId: string): Promise<number> {
  const res = await fetch(`${MIRROR}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`, {
    cache: "no-store",
  });
  if (!res.ok) return 0;
  const data = (await res.json()) as { tokens?: { balance: number }[] };
  return data.tokens?.[0]?.balance ?? 0;
}

const REFILL_CENTS = 2_000_000; // $20,000
const MARGIN_CENTS = 1_000_000; // covers a settlement the mirror has not seen yet

/**
 * Make sure every payer can cover what they are about to owe.
 *
 * The pool accounts are shared test wallets; money flows to whoever creates
 * bills, so the others drain. Before scheduling, the treasury refills any
 * account that could come up short — an ordinary, visible token transfer.
 * Better now than a schedule that executes on the last "yes" and fails.
 */
async function topUp(
  c: import("@hashgraph/sdk").Client,
  tokenId: string,
  needs: Map<string, number>,
): Promise<void> {
  const { TransferTransaction } = await import("@hashgraph/sdk");
  const treasury = process.env.HEDERA_OPERATOR_ID!;
  const tx = new TransferTransaction();
  let total = 0;
  for (const [accountId, need] of needs) {
    const have = await tokenBalance(accountId, tokenId);
    if (have - need >= MARGIN_CENTS) continue;
    const amount = need + REFILL_CENTS - have;
    tx.addTokenTransfer(tokenId, accountId, amount);
    total += amount;
  }
  if (total === 0) return;
  tx.addTokenTransfer(tokenId, treasury, -total);
  await tx.execute(c).then((r) => r.getReceipt(c));
}

/**
 * Build the whole plan as one scheduled transfer of dollars.
 *
 * `transfers` are in US cents, which is exactly the token's smallest unit, so
 * there is no rate here: a bill is converted to dollars before it arrives.
 */
export async function scheduleSettlement(
  transfers: Transfer[],
  accounts: AccountMap,
  /**
   * Identifies this settlement attempt. The same plan produces a byte-identical
   * transaction every time, and Hedera refuses to create one that duplicates a
   * schedule it still remembers — including ones that already executed. The
   * nonce rides in the memo so each attempt is its own transaction, while
   * repeating the SAME nonce stays idempotent.
   */
  nonce: string,
): Promise<ScheduleHandles> {
  if (!configured()) {
    throw new Error("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY are required");
  }
  if (transfers.length === 0) {
    throw new Error("Nothing to settle");
  }

  const missing = transfers
    .flatMap((t) => [t.from, t.to])
    .filter((p) => !accounts[p]);
  if (missing.length > 0) {
    throw new Error(`No Hedera account mapped for: ${[...new Set(missing)].join(", ")}`);
  }

  for (const t of transfers) {
    if (!Number.isSafeInteger(t.cents) || t.cents <= 0) throw new Error("Transfers must be whole, positive cents");
  }

  const { AccountId, ScheduleCreateTransaction, TransferTransaction } = await import("@hashgraph/sdk");
  const tokenId = settlementToken();

  // One entry per account: what it sends, net of what it receives.
  const net = new Map<string, number>();
  for (const t of transfers) {
    net.set(accounts[t.from], (net.get(accounts[t.from]) ?? 0) - t.cents);
    net.set(accounts[t.to], (net.get(accounts[t.to]) ?? 0) + t.cents);
  }

  const inner = new TransferTransaction();
  for (const [accountId, amount] of net) {
    if (amount !== 0) inner.addTokenTransfer(tokenId, AccountId.fromString(accountId), amount);
  }

  const awaiting = [...new Set(transfers.map((t) => t.from))];
  const c = await client();

  try {
    const needs = new Map([...net].filter(([, a]) => a < 0).map(([id, a]) => [id, -a]));
    await topUp(c, tokenId, needs);

    const receipt = await new ScheduleCreateTransaction()
      .setScheduledTransaction(inner)
      .setScheduleMemo(`Squash settlement · ${transfers.length} transfers · ${nonce}`)
      .execute(c)
      .then((tx) => tx.getReceipt(c));

    return { scheduleId: receipt.scheduleId!.toString(), awaiting };
  } catch (e) {
    // Hedera refuses to create a second schedule identical to a live one, and
    // hands back the id of the one that already exists. Settling the same plan
    // twice should be idempotent, so take that as the answer rather than an
    // error — otherwise a reload mid-signing looks like a failure.
    const existing = (e as { transactionReceipt?: { scheduleId?: { toString(): string } } })
      ?.transactionReceipt?.scheduleId;
    if (existing) {
      return { scheduleId: existing.toString(), awaiting };
    }
    throw e;
  } finally {
    c.close();
  }
}

/**
 * One party adds their signature. The last one triggers execution.
 *
 * The operator pays the fee for submitting the signature; the signature added
 * is the signer's own. Nothing about who owes what is decided here.
 */
export async function signSchedule(
  scheduleId: string,
  signerKey: string,
  keyType?: string,
): Promise<void> {
  const { ScheduleSignTransaction } = await import("@hashgraph/sdk");
  const c = await client();
  try {
    await new ScheduleSignTransaction()
      .setScheduleId(scheduleId)
      .freezeWith(c)
      .sign(await parseOperatorKey(signerKey, keyType))
      .then((tx) => tx.execute(c))
      .then((tx) => tx.getReceipt(c));
  } finally {
    c.close();
  }
}

/** Has it executed yet, and who is still missing? */
export async function scheduleStatus(scheduleId: string) {
  const { ScheduleInfoQuery } = await import("@hashgraph/sdk");
  const c = await client();
  try {
    const info = await new ScheduleInfoQuery().setScheduleId(scheduleId).execute(c);
    const executed = info.executed !== null;

    // "Executed" only means the last signature arrived. Whether the money
    // actually moved is the scheduled transaction's own result.
    let result: string | undefined;
    if (executed && info.scheduledTransactionId) {
      const { TransactionReceiptQuery } = await import("@hashgraph/sdk");
      try {
        const receipt = await new TransactionReceiptQuery()
          .setTransactionId(info.scheduledTransactionId)
          .execute(c);
        result = receipt.status.toString();
      } catch (e) {
        const status = (e as { status?: { toString(): string } }).status;
        result = status ? status.toString() : "UNKNOWN";
      }
    }

    return {
      executed,
      result,
      succeeded: executed && (result === undefined || result === "SUCCESS"),
      executedAt: info.executed?.toDate().toISOString(),
      deleted: info.deleted !== null,
      memo: info.scheduleMemo,
    };
  } finally {
    c.close();
  }
}
