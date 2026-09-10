#!/usr/bin/env node
/**
 * Creates the HCS topic the engine publishes run proofs to. Run once.
 *
 *   node scripts/create-topic.mjs
 *
 * Prints the topic id — paste it into .env.local as HEDERA_HCS_TOPIC_ID.
 * Costs testnet HBAR only, which the faucet hands out for free.
 */

import { readFileSync } from "node:fs";
import { Client, PrivateKey, TopicCreateTransaction } from "@hashgraph/sdk";

try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // no .env.local — rely on the ambient environment
}

const id = process.env.HEDERA_OPERATOR_ID;
const key = process.env.HEDERA_OPERATOR_KEY;

if (!id || !key) {
  console.error("Set HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in .env.local first.");
  console.error("Free testnet account: https://portal.hedera.com/");
  process.exit(1);
}

const client = process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
client.setOperator(id, PrivateKey.fromStringDer(key));

const receipt = await new TopicCreateTransaction()
  .setTopicMemo("Squash — netting run proofs")
  .execute(client)
  .then((tx) => tx.getReceipt(client));

console.log("");
console.log("  Topic created:", receipt.topicId.toString());
console.log("  Add to .env.local:");
console.log(`    HEDERA_HCS_TOPIC_ID=${receipt.topicId.toString()}`);
console.log("");
console.log(`  Watch it: https://hashscan.io/testnet/topic/${receipt.topicId.toString()}`);
console.log("");

client.close();
