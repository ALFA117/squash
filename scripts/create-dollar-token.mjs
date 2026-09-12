#!/usr/bin/env node
/**
 * Creates the dollar that bills settle in.
 *
 *   node scripts/create-dollar-token.mjs
 *
 * A bill is in pesos or dollars; what moves on chain has to be worth that
 * many dollars. HBAR cannot be it on testnet — a $2,500 dinner is ~33,000 ℏ
 * at the network's own rate, far beyond what a faucet hands out — and moving
 * one tinybar per cent would be a number that looks like money and is not.
 *
 * So Squash settles in an HTS fungible token with two decimals, where one
 * unit is one US cent: "Squash Test Dollar" (tUSD). It has no value and says
 * so in its memo. On mainnet the same code points at USDC, which is also an
 * HTS token with its own id; nothing else changes.
 *
 * The engine account is the treasury. Every pool and demo account is
 * associated with the token and funded with test dollars; the app tops them
 * up from the treasury whenever a settlement would need more.
 */

import { appendFileSync } from "node:fs";
import {
  Client,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenSupplyType,
  TokenType,
  TransferTransaction,
} from "@hashgraph/sdk";
import { loadEnv, parseKey } from "./key.mjs";

loadEnv(new URL("../.env.local", import.meta.url));

const FUND_CENTS = 2_000_000; // $20,000 of test dollars per account
const SUPPLY_CENTS = 1_000_000_000; // $10,000,000

if (process.env.SETTLEMENT_TOKEN_ID) {
  console.error(`SETTLEMENT_TOKEN_ID is already set (${process.env.SETTLEMENT_TOKEN_ID}). Remove it to make a new one.`);
  process.exit(1);
}

const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = parseKey(process.env.HEDERA_OPERATOR_KEY);
const client = process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
client.setOperator(operatorId, operatorKey);

const holders = [
  ...JSON.parse(process.env.POOL_ACCOUNTS_JSON ?? "[]").map((a, i) => ({ label: `pool ${i}`, ...a })),
  ...Object.entries(JSON.parse(process.env.DEMO_ACCOUNTS_JSON ?? "{}")).map(([name, a]) => ({ label: `demo ${name}`, ...a })),
];

const created = await new TokenCreateTransaction()
  .setTokenName("Squash Test Dollar")
  .setTokenSymbol("tUSD")
  .setTokenMemo("Testnet only. 1 tUSD = 1 US dollar in Squash demos; worth nothing.")
  .setTokenType(TokenType.FungibleCommon)
  .setDecimals(2)
  .setInitialSupply(SUPPLY_CENTS)
  .setSupplyType(TokenSupplyType.Infinite)
  .setTreasuryAccountId(operatorId)
  .setAdminKey(operatorKey.publicKey)
  .setSupplyKey(operatorKey.publicKey)
  .freezeWith(client)
  .sign(operatorKey)
  .then((tx) => tx.execute(client))
  .then((r) => r.getReceipt(client));

const tokenId = created.tokenId.toString();
console.log(`\n  token  ${tokenId}  tUSD, 2 decimals, treasury ${operatorId}\n`);

for (const h of holders) {
  const key = parseKey(h.key, h.keyType);
  await new TokenAssociateTransaction()
    .setAccountId(h.accountId)
    .setTokenIds([tokenId])
    .freezeWith(client)
    .sign(key)
    .then((tx) => tx.execute(client))
    .then((r) => r.getReceipt(client));

  await new TransferTransaction()
    .addTokenTransfer(tokenId, operatorId, -FUND_CENTS)
    .addTokenTransfer(tokenId, h.accountId, FUND_CENTS)
    .execute(client)
    .then((r) => r.getReceipt(client));

  console.log(`  ${h.label.padEnd(10)} ${h.accountId}  associated, $${(FUND_CENTS / 100).toLocaleString("en-US")}`);
}

appendFileSync(
  new URL("../.env.local", import.meta.url),
  `\n# The dollar bills settle in (HTS, 2 decimals, 1 unit = 1 cent). Written by create-dollar-token.mjs.\nSETTLEMENT_TOKEN_ID=${tokenId}\n`,
  "utf8",
);

console.log(`\n  SETTLEMENT_TOKEN_ID=${tokenId} written to .env.local`);
console.log(`  https://hashscan.io/testnet/token/${tokenId}\n`);
client.close();
