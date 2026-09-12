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

const created = await call("/api/groups", { adminName: "Rosa", groupName: "Cena del viernes", totalCents: 250_000 });
check("Rosa opens a $2,500 bill", created.status === 201, `status ${created.status}`);
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

const locked = await call(`/api/groups/${groupId}`, { action: "lock", ...rosa });
check("Rosa asks for confirmations — settlement goes on chain", locked.status === 200, locked.data.scheduleId ?? locked.data.error);
const scheduleId = locked.data.scheduleId;

const late = await call(`/api/groups/${groupId}`, { action: "join", name: "Late Larry" });
check("nobody can join once confirmations start", late.status === 409, `status ${late.status}`);

const change = await call(`/api/groups/${groupId}`, { action: "set-share", targetId: luis.memberId, cents: 1, ...rosa });
check("the split is frozen while people are confirming", change.status === 409, `status ${change.status}`);

const d = await call(`/api/groups/${groupId}`, { action: "confirm", ...diego });
check("Diego signs — still pending", d.status === 200 && d.data.executed === false, `executed ${d.data.executed}`);

const l = await call(`/api/groups/${groupId}`, { action: "confirm", ...luis });
check("Luis signs — it executes", l.status === 200 && l.data.executed === true, `executed ${l.data.executed}`);

g = (await call(`/api/groups/${groupId}`)).data;
check("the group is settled", g.group.status === "settled");

console.log(`\n  group     ${BASE}/g/${groupId}`);
console.log(`  schedule  https://hashscan.io/testnet/schedule/${scheduleId}`);
console.log(failures === 0 ? "\n  ALL CHECKS PASSED\n" : `\n  ${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
