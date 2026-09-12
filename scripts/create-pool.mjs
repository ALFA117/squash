#!/usr/bin/env node
/**
 * Funds a pool of testnet accounts that groups created by QR draw from.
 *
 *   node scripts/create-pool.mjs [count]
 *
 * Whoever creates a group takes pool slot 0, the next person to scan takes
 * slot 1, and so on. The pool is shared across groups — each settlement is its
 * own transaction, so two groups using the same slot never collide; balances
 * just move. Keys go to POOL_ACCOUNTS_JSON in .env.local, which is gitignored.
 *
 * These are throwaway accounts whose keys the app holds. That is a property of
 * the demo, stated as such everywhere it matters.
 */

import { appendFileSync } from "node:fs";
import { AccountCreateTransaction, Client, Hbar, PrivateKey } from "@hashgraph/sdk";
import { loadEnv, parseKey } from "./key.mjs";

loadEnv(new URL("../.env.local", import.meta.url));

const COUNT = Number(process.argv[2] ?? 10);
const INITIAL_HBAR = 25;

const id = process.env.HEDERA_OPERATOR_ID;
const key = process.env.HEDERA_OPERATOR_KEY;
if (!id || !key) {
  console.error("Set HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in .env.local first.");
  process.exit(1);
}

const client = process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
client.setOperator(id, parseKey(key));

const pool = [];
for (let i = 0; i < COUNT; i++) {
  const k = PrivateKey.generateECDSA();
  const tx = new AccountCreateTransaction().setInitialBalance(new Hbar(INITIAL_HBAR));
  if (typeof tx.setKeyWithoutAlias === "function") tx.setKeyWithoutAlias(k.publicKey);
  else tx.setKey(k.publicKey);

  const receipt = await tx.execute(client).then((r) => r.getReceipt(client));
  pool.push({ accountId: receipt.accountId.toString(), keyType: "ECDSA", key: k.toStringRaw() });
  console.log(`  slot ${String(i).padStart(2)}  ${receipt.accountId.toString()}`);
}

appendFileSync(
  new URL("../.env.local", import.meta.url),
  `\n# Pool of testnet accounts for groups joined by QR. Written by create-pool.mjs.\nPOOL_ACCOUNTS_JSON=${JSON.stringify(pool)}\n`,
  "utf8",
);

console.log(`\n  ${COUNT} accounts, ${INITIAL_HBAR} ℏ each. POOL_ACCOUNTS_JSON written to .env.local.\n`);
client.close();
