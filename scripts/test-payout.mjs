#!/usr/bin/env node
/**
 * The payer's own wallet, end to end, against a running server.
 *
 *   node scripts/test-payout.mjs [base-url]
 *
 * A local secp256k1 key stands in for the Privy embedded wallet — the same
 * kind of key, sending through the same Hedera JSON-RPC relay Privy uses —
 * so the chain side is proven without a browser login:
 *   1. Rosa sets her wallet as where she is paid;
 *   2. the bill settles; her share of the money lands in that wallet;
 *   3. from the wallet she sends tUSD on, as an ERC-20 transfer on Hedera EVM.
 */
import { createPublicClient, createWalletClient, defineChain, encodeFunctionData, http, parseAbi } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.argv[2] ?? "http://localhost:3030";
const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";
const TOKEN = "0.0.10511085";
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};
const call = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
};
const longZero = (id) => "0x" + Number(id.split(".").pop()).toString(16).padStart(40, "0");
const balance = async (acct) => {
  const d = await fetch(`${MIRROR}/accounts/${acct}/tokens?token.id=${TOKEN}`).then((r) => r.json());
  return d.tokens?.[0]?.balance ?? null;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const hedera = defineChain({
  id: 296,
  name: "Hedera Testnet",
  nativeCurrency: { decimals: 18, name: "HBAR", symbol: "HBAR" },
  rpcUrls: { default: { http: ["https://testnet.hashio.io/api"] } },
});

console.log("\n── the payer's own wallet ─────────────────────────────────");
const wallet = privateKeyToAccount(generatePrivateKey());
const created = await call("/api/groups", { adminName: "Rosa", groupName: "Payout test", totalCents: 60_000, currency: "MXN" });
const rosa = { memberId: created.data.memberId, secret: created.data.secret };
const gid = created.data.groupId;
const diego = (await call(`/api/groups/${gid}`, { action: "join", name: "Diego" })).data;

const byGuest = await call(`/api/groups/${gid}`, { action: "payout-wallet", evm: wallet.address, ...diego });
check("a guest cannot redirect the payer's money", byGuest.status === 403, `status ${byGuest.status}`);

const set = await call(`/api/groups/${gid}`, { action: "payout-wallet", evm: wallet.address, ...rosa });
check("Rosa's wallet becomes a Hedera account that holds tUSD", set.status === 200 && /^0\.0\.\d+$/.test(set.data.account ?? ""), set.data.account ?? set.data.error);
const account = set.data.account;

const locked = await call(`/api/groups/${gid}`, { action: "lock", ...rosa });
const owed = locked.data.usdCents?.[diego.memberId];
const confirmed = await call(`/api/groups/${gid}`, { action: "confirm", ...diego });
check("the bill settles", confirmed.data.executed === true, `schedule ${locked.data.scheduleId}`);

let got = null;
for (let i = 0; i < 10 && (got ?? 0) < 1 + owed; i++) { await sleep(2500); got = await balance(account); }
check("what Diego owed landed in Rosa's own wallet", got === 1 + owed, `${got} cents in ${account}, owed ${owed}`);

console.log("\n── spending from it ─────────────────────────────────────────");
const rpc = createPublicClient({ chain: hedera, transport: http() });
const signer = createWalletClient({ account: wallet, chain: hedera, transport: http() });
const to = longZero("0.0.10509911"); // a pool account, associated with tUSD
const amount = 100n; // US$1.00
const hash = await signer.sendTransaction({
  to: longZero(TOKEN),
  data: encodeFunctionData({ abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]), functionName: "transfer", args: [to, amount] }),
  gas: 120_000n,
});
const receipt = await rpc.waitForTransactionReceipt({ hash, timeout: 60_000 });
check("the wallet sends US$1.00 on, as an ERC-20 transfer on Hedera EVM", receipt.status === "success", hash);

let after = got;
for (let i = 0; i < 10 && after === got; i++) { await sleep(2500); after = await balance(account); }
check("and the balance moves", after === got - Number(amount), `${got} → ${after}`);

console.log(`\n  wallet   ${wallet.address}  →  ${account}`);
console.log(`  hashscan https://hashscan.io/testnet/account/${account}`);
console.log(failures === 0 ? "\n  ALL CHECKS PASSED\n" : `\n  ${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
