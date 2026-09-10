#!/usr/bin/env node
/**
 * Gives every person in the demo group their own testnet account.
 *
 *   node scripts/create-demo-accounts.mjs
 *
 * Writes demo-accounts.json (gitignored). These are throwaway testnet
 * accounts funded from the operator's faucet balance; they exist so the
 * settlement can actually move money between six different parties instead of
 * pretending to. A real deployment would give each user their own wallet and
 * never hold their key — see STATUS.md.
 */

import { appendFileSync, writeFileSync } from "node:fs";
import { AccountCreateTransaction, Client, Hbar, PrivateKey } from "@hashgraph/sdk";
import { loadEnv, parseKey } from "./key.mjs";

loadEnv(new URL("../.env.local", import.meta.url));

const PEOPLE = ["tu", "rosa", "mariana", "ana", "diego", "luis"];
const INITIAL_HBAR = 20;

const id = process.env.HEDERA_OPERATOR_ID;
const key = process.env.HEDERA_OPERATOR_KEY;
if (!id || !key) {
  console.error("Set HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in .env.local first.");
  console.error("Free testnet account: https://portal.hedera.com/");
  process.exit(1);
}

const client = process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
client.setOperator(id, parseKey(key));

const accounts = {};

for (const person of PEOPLE) {
  const personKey = PrivateKey.generateECDSA();

  const tx = new AccountCreateTransaction().setInitialBalance(new Hbar(INITIAL_HBAR));
  if (typeof tx.setKeyWithoutAlias === "function") {
    tx.setKeyWithoutAlias(personKey.publicKey);
  } else {
    tx.setKey(personKey.publicKey);
  }

  const receipt = await tx.execute(client).then((r) => r.getReceipt(client));
  accounts[person] = {
    accountId: receipt.accountId.toString(),
    keyType: "ECDSA",
    key: personKey.toStringRaw(),
  };

  console.log(`  ${person.padEnd(8)} ${accounts[person].accountId}`);
}

const path = new URL("../demo-accounts.json", import.meta.url);
writeFileSync(path, `${JSON.stringify(accounts, null, 2)}\n`, "utf8");

appendFileSync(
  new URL("../.env.local", import.meta.url),
  `
# Throwaway testnet accounts for the demo group. Written by create-demo-accounts.mjs.
DEMO_ACCOUNTS_JSON=${JSON.stringify(accounts)}
`,
  "utf8",
);

console.log("");
console.log("  Wrote demo-accounts.json and DEMO_ACCOUNTS_JSON in .env.local.");
console.log("  Both are gitignored, testnet only.");
console.log(`  Funded ${PEOPLE.length} accounts with ${INITIAL_HBAR} ℏ each.`);
console.log("");

client.close();
