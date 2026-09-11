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
 * Build the whole plan as one scheduled transfer.
 *
 * `rate` converts the ledger's cents into tinybars. In a real deployment the
 * settlement leg would be a stablecoin (an HTS token) rather than HBAR, and
 * this is where that swap happens — the atomicity argument is identical.
 */
export async function scheduleSettlement(
  transfers: Transfer[],
  accounts: AccountMap,
  rate: (cents: number) => number,
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

  const { AccountId, Hbar, ScheduleCreateTransaction, TransferTransaction } = await import(
    "@hashgraph/sdk"
  );

  const inner = new TransferTransaction();
  for (const t of transfers) {
    const tinybars = rate(t.cents);
    inner.addHbarTransfer(AccountId.fromString(accounts[t.from]), Hbar.fromTinybars(-tinybars));
    inner.addHbarTransfer(AccountId.fromString(accounts[t.to]), Hbar.fromTinybars(tinybars));
  }

  const awaiting = [...new Set(transfers.map((t) => t.from))];
  const c = await client();

  try {
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
 * Build a ScheduleSignTransaction and return its bytes for client-side signing.
 */
export async function buildSignTransactionBytes(
  scheduleId: string,
): Promise<Uint8Array> {
  const { ScheduleSignTransaction } = await import("@hashgraph/sdk");
  const c = await client();
  try {
    const tx = new ScheduleSignTransaction()
      .setScheduleId(scheduleId)
      .freezeWith(c);
    return tx.toBytes();
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
    return {
      executed: info.executed !== null,
      executedAt: info.executed?.toDate().toISOString(),
      deleted: info.deleted !== null,
      memo: info.scheduleMemo,
    };
  } finally {
    c.close();
  }
}
