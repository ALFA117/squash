#!/usr/bin/env node
/**
 * Creates a second testnet account for the AGENT.
 *
 * The service and its caller have to be different parties — an agent paying
 * its own account is a transfer that nets to nothing, and the facilitator
 * rejects it. This funds a separate account from the operator's balance.
 *
 *   node scripts/create-agent.mjs
 */

import { AccountCreateTransaction, Client, Hbar, PrivateKey } from "@hashgraph/sdk";
import { loadEnv, parseKey } from "./key.mjs";

loadEnv(new URL("../.env.local", import.meta.url));

const id = process.env.HEDERA_OPERATOR_ID;
const key = process.env.HEDERA_OPERATOR_KEY;
if (!id || !key) {
  console.error("Set HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in .env.local first.");
  process.exit(1);
}

const client = process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
client.setOperator(id, parseKey(key));

const agentKey = PrivateKey.generateECDSA();

const tx = new AccountCreateTransaction().setInitialBalance(new Hbar(50));
// Newer SDKs split these; use whichever this version exposes.
if (typeof tx.setKeyWithoutAlias === "function") {
  tx.setKeyWithoutAlias(agentKey.publicKey);
} else {
  tx.setKey(agentKey.publicKey);
}

const receipt = await tx.execute(client).then((r) => r.getReceipt(client));
const accountId = receipt.accountId.toString();

console.log("");
console.log("  Agent account:", accountId);
console.log("  Add to .env.local:");
console.log(`    AGENT_ACCOUNT_ID=${accountId}`);
console.log(`    AGENT_KEY_TYPE=ECDSA`);
console.log(`    AGENT_KEY=${agentKey.toStringRaw()}`);
console.log("");
console.log(`  https://hashscan.io/testnet/account/${accountId}`);
console.log("");

client.close();
