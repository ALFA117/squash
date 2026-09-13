#!/usr/bin/env node
/**
 * The whole dinner, end to end, against a running server — including the
 * attacks. Moves real testnet HBAR and checks the balances afterwards.
 *
 *   node scripts/test-dinner.mjs [base-url]
 */

const BASE = process.argv[2] ?? "http://localhost:3030";
let failures = 0;

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

const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

const money = (c) => `$${(c / 100).toFixed(2)}`;

console.log("\n── the dinner ───────────────────────────────────────────────");

const created = await call("/api/groups", { adminName: "Rosa", groupName: "Cena del viernes", totalCents: 250_000, currency: "MXN" });
check("Rosa opens a $2,500 MXN bill", created.status === 201, `status ${created.status}`);
const { groupId, memberId: rosaId, secret: rosaSecret } = created.data;
const rosa = { memberId: rosaId, secret: rosaSecret };

const diegoR = await call(`/api/groups/${groupId}`, { action: "join", name: "Diego" });
const luisR = await call(`/api/groups/${groupId}`, { action: "join", name: "Luis" });
check("Diego scans in", diegoR.status === 201);
check("Luis scans in", luisR.status === 201);
const diego = diegoR.data;
const luis = luisR.data;

let g = (await call(`/api/groups/${groupId}`)).data;
const shares = g.members.map((m) => m.share_cents);
check("equal split among three, to the cent", JSON.stringify(shares) === JSON.stringify([83_334, 83_333, 83_333]),
  shares.map(money).join(" / "));
check("shares add back to the bill", shares.reduce((a, b) => a + b, 0) === 250_000);
check("no secrets in what anyone can read", !JSON.stringify(g).includes(rosaSecret) && !JSON.stringify(g).includes("secret_hash"));

console.log("\n── attacks ──────────────────────────────────────────────────");

const notAdmin = await call(`/api/groups/${groupId}`, { action: "mode", mode: "custom", ...diego });
check("Diego cannot change the split", notAdmin.status === 403, `status ${notAdmin.status}`);

const forged = await call(`/api/groups/${groupId}`, { action: "confirm", memberId: diego.memberId, secret: "0".repeat(64) });
check("a forged secret is refused", forged.status === 401, `status ${forged.status}`);

const borrowed = await call(`/api/groups/${groupId}`, { action: "confirm", memberId: diego.memberId, secret: luis.secret });
check("Luis cannot confirm as Diego", borrowed.status === 401, `status ${borrowed.status}`);

const early = await call(`/api/groups/${groupId}`, { action: "confirm", ...diego });
check("nobody confirms before the admin asks", early.status === 409, `status ${early.status}`);

const badMoney = await call(`/api/groups`, { adminName: "X", groupName: "Y", totalCents: 12.5 });
check("fractional cents are refused", badMoney.status === 400, `status ${badMoney.status}`);

console.log("\n── custom amounts ───────────────────────────────────────────");

await call(`/api/groups/${groupId}`, { action: "mode", mode: "custom", ...rosa });
await call(`/api/groups/${groupId}`, { action: "set-share", targetId: rosaId, cents: 100_000, ...rosa });
await call(`/api/groups/${groupId}`, { action: "set-share", targetId: diego.memberId, cents: 100_000, ...rosa });
await call(`/api/groups/${groupId}`, { action: "set-share", targetId: luis.memberId, cents: 40_000, ...rosa });
const short = await call(`/api/groups/${groupId}`, { action: "lock", ...rosa });
check("cannot lock while the shares are $100 short", short.status === 400, short.data.error);

await call(`/api/groups/${groupId}`, { action: "set-share", targetId: luis.memberId, cents: 50_000, ...rosa });
g = (await call(`/api/groups/${groupId}`)).data;
check("custom shares now add to the bill", g.members.reduce((a, m) => a + m.share_cents, 0) === 250_000,
  g.members.map((m) => `${m.name} ${money(m.share_cents)}`).join(", "));

console.log("\n── confirm and pay ──────────────────────────────────────────");

// ── fixing the table: a duplicate join, taken off by the admin ──
const dup = await call(`/api/groups/${groupId}`, { action: "join", name: "Diego again" });
const kickByGuest = await call(`/api/groups/${groupId}`, { action: "remove", targetId: dup.data.memberId, ...luis });
check("a guest cannot take someone off the table", kickByGuest.status === 403, `status ${kickByGuest.status}`);
const kick = await call(`/api/groups/${groupId}`, { action: "remove", targetId: dup.data.memberId, ...rosa });
g = (await call(`/api/groups/${groupId}`)).data;
check("the admin takes a duplicate join off the table", kick.status === 200 && g.members.length === 3, `${g.members.length} at the table`);

const locked = await call(`/api/groups/${groupId}`, { action: "lock", ...rosa });
check("Rosa asks for confirmations — settlement goes on chain", locked.status === 200, locked.data.scheduleId ?? locked.data.error);
const scheduleId = locked.data.scheduleId;
const planReceipt = locked.data.planReceipt;
const rate = locked.data.rate?.usdPerUnit;
check("pesos are converted at today's real rate", rate > 0.03 && rate < 0.12, `1 MXN = ${rate} USD, ${locked.data.rate?.source} ${locked.data.rate?.asOf}`);
const usd = locked.data.usdCents ?? {};
const usdTotal = Object.values(usd).reduce((a, b) => a + b, 0);
check("the dollar shares add up to the converted bill", usdTotal === Math.round(250_000 * rate), `${money(usdTotal)} USD`);
check("the plan was bought from the engine over x402", /^0\.0\.\d+@\d+\.\d+$/.test(planReceipt ?? ""), planReceipt ?? "no receipt");

const late = await call(`/api/groups/${groupId}`, { action: "join", name: "Late Larry" });
check("nobody can join once confirmations start", late.status === 409, `status ${late.status}`);

const change = await call(`/api/groups/${groupId}`, { action: "set-share", targetId: luis.memberId, cents: 1, ...rosa });
check("the split is frozen while people are confirming", change.status === 409, `status ${change.status}`);

const d = await call(`/api/groups/${groupId}`, { action: "confirm", ...diego });
check("Diego signs — still pending", d.status === 200 && d.data.executed === false, `executed ${d.data.executed}`);

// Luis lost his phone: the admin hands his seat to the new one.
const seatByGuest = await call(`/api/groups/${groupId}`, { action: "reissue", targetId: luis.memberId, ...diego });
check("a guest cannot hand out seats", seatByGuest.status === 403, `status ${seatByGuest.status}`);
const seat = await call(`/api/groups/${groupId}`, { action: "reissue", targetId: luis.memberId, ...rosa });
const oldPhone = await call(`/api/groups/${groupId}`, { action: "confirm", ...luis });
check("the admin gives Luis his seat back; his old phone stops working", seat.status === 200 && oldPhone.status === 401, `old secret -> ${oldPhone.status}`);

const l = await call(`/api/groups/${groupId}`, { action: "confirm", memberId: seat.data.memberId, secret: seat.data.secret });
check("Luis signs from his new phone — it executes", l.status === 200 && l.data.executed === true, `executed ${l.data.executed}`);

g = (await call(`/api/groups/${groupId}`)).data;
check("the group is settled", g.group.status === "settled");

// What actually moved: read the executed transaction off the mirror node.
const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";
let moved = null;
for (let i = 0; i < 12 && !moved; i++) {
  await new Promise((r) => setTimeout(r, 2500));
  const sched = await fetch(`${MIRROR}/schedules/${scheduleId}`).then((r) => r.json());
  if (!sched.executed_timestamp) continue;
  const txs = await fetch(`${MIRROR}/transactions?timestamp=${sched.executed_timestamp}`).then((r) => r.json());
  moved = txs.transactions?.[0];
}
const tokenMoves = (moved?.token_transfers ?? []).filter((t) => t.token_id === g.group.settle_token);
const debited = -tokenMoves.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0);
const owedUsd = g.members.filter((m) => m.id !== g.group.payer_id).reduce((a, m) => a + m.settle_usd_cents, 0);
check("on chain it moved dollars (tUSD), exactly what was confirmed", moved?.result === "SUCCESS" && debited === owedUsd && debited > 0,
  `${moved?.result ?? "not found"} · ${money(debited)} tUSD of token ${g.group.settle_token}`);

console.log(`\n  group     ${BASE}/g/${groupId}`);
console.log(`  schedule  https://hashscan.io/testnet/schedule/${scheduleId}`);
if (planReceipt) {
  const [acct, stamp] = planReceipt.split("@");
  console.log(`  x402 paid https://hashscan.io/testnet/transaction/${acct}-${stamp.replace(".", "-")}`);
}
console.log(failures === 0 ? "\n  ALL CHECKS PASSED\n" : `\n  ${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
