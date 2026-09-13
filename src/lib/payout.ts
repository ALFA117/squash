import { parseOperatorKey } from "./hederaKey";
import { settlementToken } from "./scheduled";

/**
 * The payer's own wallet, as a place for the money to land.
 *
 * Whoever paid the bill can sign in with an email (Privy) and get an
 * embedded wallet — an ordinary secp256k1 key the app never sees. On Hedera
 * that key's EVM address is an account alias: send it something and the
 * network creates the account. So before the bill is locked, the treasury
 * sends the address a little HBAR (for its own fees later) and one cent of
 * tUSD (which associates the token), and the settlement then credits that
 * account directly. The money someone is owed ends up in their wallet, not
 * in an account the app holds.
 */

const SEED_HBAR = 2; // enough for a few transfers of its own
const MIRROR =
  process.env.HEDERA_NETWORK === "mainnet"
    ? "https://mainnet.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";

export function isEvmAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** 0.0.N → the EVM address Hedera exposes for it (the "long-zero" form). */
export function longZero(entityId: string): string {
  const num = Number(entityId.split(".").pop());
  return "0x" + num.toString(16).padStart(40, "0");
}

async function client() {
  const { Client } = await import("@hashgraph/sdk");
  const c = process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  c.setOperator(process.env.HEDERA_OPERATOR_ID!, await parseOperatorKey(process.env.HEDERA_OPERATOR_KEY));
  c.setRequestTimeout(25_000);
  return c;
}

/** tUSD held by an account, in US cents, per the mirror node. */
export async function tokenCents(accountId: string): Promise<number | null> {
  const res = await fetch(`${MIRROR}/api/v1/accounts/${accountId}/tokens?token.id=${settlementToken()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { tokens?: { balance: number }[] };
  return data.tokens?.[0]?.balance ?? null;
}

/**
 * Make sure a wallet address is a Hedera account that can hold tUSD, and
 * return its account id. Safe to call again for the same address.
 */
export async function ensureWalletAccount(evm: string): Promise<string> {
  if (!isEvmAddress(evm)) throw new Error("That is not a wallet address");
  const address = evm.toLowerCase();
  const { AccountId, AccountInfoQuery, Hbar, TransferTransaction } = await import("@hashgraph/sdk");
  const tokenId = settlementToken();
  const treasury = process.env.HEDERA_OPERATOR_ID!;
  const alias = AccountId.fromEvmAddress(0, 0, address);
  const c = await client();

  try {
    let accountId: string | null = null;
    try {
      const info = await new AccountInfoQuery().setAccountId(alias).execute(c);
      accountId = info.accountId.toString();
    } catch {
      accountId = null; // not created yet
    }

    if (!accountId) {
      await new TransferTransaction()
        .addHbarTransfer(treasury, new Hbar(-SEED_HBAR))
        .addHbarTransfer(alias, new Hbar(SEED_HBAR))
        .execute(c)
        .then((r) => r.getReceipt(c));
      const info = await new AccountInfoQuery().setAccountId(alias).execute(c);
      accountId = info.accountId.toString();
    }

    // One cent of tUSD: if it lands, the account holds the token and the
    // settlement can pay into it. If it cannot, better to know now than on
    // the last "yes".
    if ((await tokenCents(accountId)) === null) {
      await new TransferTransaction()
        .addTokenTransfer(tokenId, treasury, -1)
        .addTokenTransfer(tokenId, accountId, 1)
        .execute(c)
        .then((r) => r.getReceipt(c));
    }
    return accountId;
  } finally {
    c.close();
  }
}
