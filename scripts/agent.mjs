#!/usr/bin/env node
/**
 * The paying agent.
 *
 * Discovers the netting service, is told what it costs, pays, and gets its
 * answer. No API key, no account with us, no subscription — it pays for the
 * graph it brought.
 *
 *   node scripts/agent.mjs [url]
 *
 * The payment payload is built by the official @x402/hedera client rather than
 * by hand. The facilitator validates the serialized transaction strictly and
 * rejects a hand-rolled one with no diagnostic at all.
 */

import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactHederaScheme, PrivateKey, createClientHederaSigner } from "@x402/hedera";
import { loadEnv } from "./key.mjs";

loadEnv(new URL("../.env.local", import.meta.url));

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
const REQUEST = {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(WORK),
};

function readKey(raw, type) {
  const value = String(raw ?? "").trim().replace(/^0x/, "");
  const declared = String(type ?? "").trim().toUpperCase();
  if (declared === "ED25519") return PrivateKey.fromStringED25519(value);
  if (declared === "ECDSA") return PrivateKey.fromStringECDSA(value);
  return PrivateKey.fromStringDer(value);
}

async function main() {
  // Ask once without paying, purely so the challenge is visible on camera.
  rule();
  log("STEP 1  asking for the work, carrying no payment");
  log(`        POST ${ENDPOINT}`);

  const probe = await fetch(ENDPOINT, REQUEST);

  if (probe.status === 200) {
    const data = await probe.json();
    log(`        200 OK — the gate is off (gated: ${data.gated})`);
    log("        Set X402_ENABLED=true to make this a paid request.");
    report(data, probe);
    return;
  }

  if (probe.status !== 402) {
    log(`        unexpected ${probe.status}: ${(await probe.text()).slice(0, 300)}`);
    process.exit(1);
  }

  const challenge = await probe.json();
  const req = challenge.accepts?.[0];

  rule();
  log("STEP 2  402 Payment Required");
  log(`        network      ${req.network}`);
  log(`        asset        ${req.asset === "0.0.0" ? "HBAR (0.0.0)" : req.asset}`);
  log(`        amount       ${req.amount} tinybars  (${Number(req.amount) / 1e8} ℏ)`);
  log(`        payTo        ${req.payTo}`);
  log(`        feePayer     ${req.extra?.feePayer}  <- the facilitator sponsors the fee`);

  const accountId = process.env.AGENT_ACCOUNT_ID;
  const rawKey = process.env.AGENT_KEY;
  if (!accountId || !rawKey) {
    log("");
    log("        No AGENT_ACCOUNT_ID / AGENT_KEY — cannot sign.");
    log("        Run: node scripts/create-agent.mjs");
    process.exit(1);
  }
  if (accountId === req.payTo) {
    log("");
    log("        The agent and the service are the same account — a transfer");
    log("        that nets to nothing. Run: node scripts/create-agent.mjs");
    process.exit(1);
  }

  rule();
  log("STEP 3  paying and retrying");
  log(`        paying from  ${accountId}`);

  const signer = createClientHederaSigner(accountId, readKey(rawKey, process.env.AGENT_KEY_TYPE));

  // The SDK's default spend controls only allow each chain's default asset,
  // which on Hedera is USDC. We price in HBAR, so allow it explicitly rather
  // than switching off the guardrail wholesale.
  const client = new x402Client()
    .register(req.network, new ExactHederaScheme(signer))
    .setSpendControls({ allowedAssets: true });
  const fetchWithPay = wrapFetchWithPayment(fetch, client);

  const started = Date.now();
  const paidResponse = await fetchWithPay(ENDPOINT, REQUEST);
  const elapsed = Date.now() - started;

  const data = await paidResponse.json();

  if (paidResponse.status !== 200) {
    log(`        ${paidResponse.status} — ${data.error ?? JSON.stringify(data).slice(0, 300)}`);
    process.exit(1);
  }

  rule();
  log("STEP 4  paid");
  log(`        200 OK in ${elapsed} ms`);
  log(`        paid         ${data.paid}`);
  if (data.payer) log(`        payer        ${data.payer}`);
  if (data.receipt) log(`        receipt      ${data.receipt}`);

  report(data, paidResponse);
}

function report(data, response) {
  const hcs = response?.headers?.get?.("hcs-message");
  rule();
  log("RESULT");
  log(`        ${data.grossEdges.length} obligations  ->  ${data.transfers.length} transfers`);
  log(`        compression  ${Math.round(data.compression * 100)}%`);
  log(`        minimal      ${data.optimal ? "yes, proven" : "no, greedy fallback"}`);
  log("");
  for (const t of data.transfers) {
    log(`        ${t.from.padEnd(9)} -> ${t.to.padEnd(9)} ${(t.cents / 100).toFixed(2).padStart(10)}`);
  }
  if (data.proof?.inputHash) {
    log("");
    log(`        input hash   ${data.proof.inputHash}`);
    if (hcs) log(`        hcs message  ${hcs}`);
    if (data.proof.error) log(`        (not published: ${data.proof.error})`);
  }
  rule();
}

main().catch((e) => {
  console.error("agent failed:", e.message);
  process.exit(1);
});
