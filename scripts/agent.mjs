#!/usr/bin/env node
/**
 * The paying agent.
 *
 * Discovers the netting service, gets told what it costs, pays, and gets its
 * answer. No API key, no account with us, no subscription — it just pays for
 * the graph it brought.
 *
 *   node scripts/agent.mjs [url]
 *
 * Needs HEDERA_OPERATOR_ID / HEDERA_OPERATOR_KEY in .env.local for a funded
 * TESTNET account. Never point this at a key holding real funds.
 */

import { readFileSync } from "node:fs";
import { AccountId, Hbar, PrivateKey, TransferTransaction, TransactionId } from "@hashgraph/sdk";

// --- tiny .env.local reader so the script has no extra dependency ----------
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // no .env.local — rely on the ambient environment
}

const ENDPOINT = process.argv[2] ?? "http://localhost:3030/api/v1/net";

const WORK = {
  expenses: [
    { id: "e1", label: "Casa completa, 2 noches", payer: "rosa", cents: 464400, among: ["tu", "rosa", "mariana", "ana", "diego", "luis"] },
    { id: "e2", label: "Cena y bar del sábado", payer: "mariana", cents: 371400, among: ["tu", "rosa", "mariana", "ana", "diego", "luis"] },
    { id: "e3", label: "Súper y desayunos", payer: "ana", cents: 317400, among: ["tu", "rosa", "mariana", "ana", "diego", "luis"] },
    { id: "e4", label: "Combustible ida y vuelta", payer: "luis", cents: 203400, among: ["tu", "rosa", "mariana", "ana", "diego", "luis"] },
    { id: "e5", label: "Lancha en la presa", payer: "diego", cents: 149400, among: ["tu", "rosa", "mariana", "ana", "diego", "luis"] },
    { id: "e6", label: "Casetas de la autopista", payer: "tu", cents: 56400, among: ["tu", "rosa", "mariana", "ana", "diego", "luis"] },
  ],
};

const log = (...a) => console.log(...a);
const rule = () => log("─".repeat(64));

async function main() {
  rule();
  log("STEP 1  asking for the work, carrying no payment");
  log(`        POST ${ENDPOINT}`);

  const first = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(WORK),
  });

  if (first.status === 200) {
    const body = await first.json();
    log(`        200 OK — the gate is off (gated: ${body.gated})`);
    log("        Set X402_ENABLED=true to make this a paid request.");
    report(body);
    return;
  }

  if (first.status !== 402) {
    log(`        unexpected ${first.status}: ${(await first.text()).slice(0, 300)}`);
    process.exit(1);
  }

  const challenge = await first.json();
  const req = challenge.accepts?.[0];
  if (!req) {
    log("        402 with no `accepts` — cannot pay");
    process.exit(1);
  }

  rule();
  log("STEP 2  402 Payment Required");
  log(`        network      ${req.network}`);
  log(`        asset        ${req.asset === "0.0.0" ? "HBAR (0.0.0)" : req.asset}`);
  log(`        amount       ${req.amount} tinybars  (${Number(req.amount) / 1e8} ℏ)`);
  log(`        payTo        ${req.payTo}`);
  log(`        feePayer     ${req.extra?.feePayer}  <- the facilitator sponsors the fee`);

  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  if (!operatorId || !operatorKey) {
    log("");
    log("        No HEDERA_OPERATOR_ID / HEDERA_OPERATOR_KEY — cannot sign.");
    log("        Create a free testnet account at https://portal.hedera.com/");
    log("        and put the values in .env.local. Nothing else is needed.");
    process.exit(1);
  }

  rule();
  log("STEP 3  building and partially signing the transfer");

  const payer = AccountId.fromString(operatorId);
  const feePayer = AccountId.fromString(req.extra.feePayer);
  const key = PrivateKey.fromStringDer(operatorKey);
  const tinybars = Number(req.amount);

  // The transaction id names the FEE PAYER, so the facilitator's account is
  // the one charged for network fees. We only move our own funds.
  const transfer = new TransferTransaction()
    .setTransactionId(TransactionId.generate(feePayer))
    .setNodeAccountIds([new AccountId(3)])
    .addHbarTransfer(payer, Hbar.fromTinybars(-tinybars))
    .addHbarTransfer(AccountId.fromString(req.payTo), Hbar.fromTinybars(tinybars))
    .freeze();

  const signed = await transfer.sign(key);
  const b64 = Buffer.from(signed.toBytes()).toString("base64");

  log(`        signed by    ${operatorId}  (partial — fee payer signs next)`);
  log(`        payload      ${b64.slice(0, 44)}…  (${b64.length} bytes)`);

  const header = Buffer.from(
    JSON.stringify({
      x402Version: 2,
      scheme: req.scheme,
      network: req.network,
      payload: { transaction: b64 },
    }),
  ).toString("base64");

  rule();
  log("STEP 4  retrying with X-PAYMENT");

  const started = Date.now();
  const second = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-payment": header },
    body: JSON.stringify(WORK),
  });
  const elapsed = Date.now() - started;

  const body = await second.json();

  if (second.status !== 200) {
    log(`        ${second.status} — ${body.error ?? JSON.stringify(body).slice(0, 300)}`);
    process.exit(1);
  }

  log(`        200 OK in ${elapsed} ms`);
  log(`        paid         ${body.paid}`);
  if (body.payer) log(`        payer        ${body.payer}`);
  if (body.receipt) log(`        receipt      ${body.receipt}`);
  const hcs = second.headers.get("hcs-message");
  if (hcs) log(`        hcs-message  ${hcs}`);

  report(body);
}

function report(body) {
  rule();
  log("RESULT");
  log(`        ${body.grossEdges.length} obligations  ->  ${body.transfers.length} transfers`);
  log(`        compression  ${Math.round(body.compression * 100)}%`);
  log(`        minimal      ${body.optimal ? "yes, proven" : "no, greedy fallback"}`);
  log("");
  for (const t of body.transfers) {
    log(`        ${t.from.padEnd(9)} -> ${t.to.padEnd(9)} ${(t.cents / 100).toFixed(2).padStart(10)}`);
  }
  if (body.proof?.inputHash) {
    log("");
    log(`        input hash   ${body.proof.inputHash}`);
    log(`        ${body.proof.error ? `(not published: ${body.proof.error})` : "published to HCS — anyone can recompute it"}`);
  }
  rule();
}

main().catch((e) => {
  console.error("agent failed:", e.message);
  process.exit(1);
});
