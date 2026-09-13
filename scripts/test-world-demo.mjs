#!/usr/bin/env node
/**
 * World ID seat rules, end to end, in demo mode (WORLD_DEMO=1 on the server).
 *
 *   node scripts/test-world-demo.mjs [base-url]
 *
 * The World App step is simulated; everything the app does with the result
 * is real: verified-only tables, one seat per person per table, eligibility
 * to lock, and getting a lost seat back by verifying again.
 */
import { randomBytes } from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3030";
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
const person = () => ({ demo: true, subject: randomBytes(32).toString("hex") });

console.log("\n── verified people only (World ID, simulated) ────────────────");
const g = (await call("/api/groups", { adminName: "Oni", groupName: "World table", totalCents: 30_000, currency: "MXN" })).data;
const oni = { memberId: g.memberId, secret: g.secret };
const at = `/api/groups/${g.groupId}`;

const on = await call(at, { action: "require-human", on: true, ...oni });
check("the admin makes it a verified-people-only table", on.status === 200, `status ${on.status}`);

const noProof = await call(at, { action: "join", name: "Stranger" });
check("nobody takes a seat without verifying", noProof.status === 403, `status ${noProof.status}`);

const forged = await call(at, { action: "join", name: "Forger", proof: { demo: true, subject: "not-hex" } });
check("a malformed proof is refused", forged.status === 403, `status ${forged.status}`);

const diegoId = person();
const diego = await call(at, { action: "join", name: "Diego", proof: diegoId });
check("Diego verifies and takes a seat", diego.status === 201, `status ${diego.status}`);

const twice = await call(at, { action: "join", name: "Diego again", proof: diegoId });
check("the same person cannot take a second seat", twice.status === 409, twice.data.error);

let table = (await call(at)).data;
check("Diego's seat shows as verified, and no nullifier is public",
  table.members.find((m) => m.name === "Diego")?.human_verified === true && !JSON.stringify(table).includes("demo:"));

const early = await call(at, { action: "lock", ...oni });
check("confirmations wait until every seat is verified", early.status === 400, early.data.error);

const oniV = await call(at, { action: "verify-human", proof: person(), ...oni });
check("Oni verifies from her own seat", oniV.status === 200, `status ${oniV.status}`);

console.log("\n── getting a seat back ───────────────────────────────────────");
const back = await call(at, { action: "recover-human", proof: diegoId });
check("Diego, on a new phone, verifies again and gets his seat back", back.status === 200 && back.data.memberId === diego.data.memberId, back.data.memberId);
const oldPhone = await call(at, { action: "own-share", cents: 1, ...diego.data });
check("his old session stops working", oldPhone.status === 401, `status ${oldPhone.status}`);
const nobody = await call(at, { action: "recover-human", proof: person() });
check("someone who never sat here gets nothing", nobody.status === 404, `status ${nobody.status}`);

const locked = await call(at, { action: "lock", ...oni });
check("with everyone verified, the bill locks", locked.status === 200, locked.data.scheduleId ?? locked.data.error);
const paid = await call(at, { action: "confirm", ...back.data });
check("Diego confirms from the recovered seat — it settles", paid.data.executed === true, `executed ${paid.data.executed}`);

console.log(failures === 0 ? "\n  ALL CHECKS PASSED\n" : `\n  ${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
