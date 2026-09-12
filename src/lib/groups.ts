import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { usdRate } from "./fx";
import { isCurrency, toUsdCents, type Currency } from "./money";
import type { Transfer } from "./netting";
import { fetchPaidPlan } from "./payingClient";
import { pool, poolSize } from "./pool";
import { scheduleSettlement, scheduleStatus, settlementToken, signSchedule } from "./scheduled";
import { checkShares, equalShares, transfersToPayer, type SplitMode } from "./split";
import { serverClient } from "./supabase";

/**
 * A group splitting one bill — server side only.
 *
 * The rules this file enforces, because nothing else can:
 *
 *  - Only the admin changes how the bill is split.
 *  - Nobody confirms on someone else's behalf. Every write that acts as a
 *    person must present that person's secret, which only their phone holds.
 *  - The split is frozen before anyone confirms. Once the admin asks for
 *    confirmations, the settlement transaction already exists on chain with
 *    those exact amounts; changing a share after that would mean people agreed
 *    to one number and paid another. Reopening throws the pending transaction
 *    away — it simply never executes — and clears every confirmation.
 *  - A confirmation IS a signature. It is not recorded until the person's
 *    signature has actually landed on the scheduled transaction.
 */

export interface GroupRow {
  id: string;
  name: string;
  total_cents: number;
  payer_id: string;
  split_mode: SplitMode;
  status: "open" | "locked" | "settled";
  schedule_id: string | null;
  /** The Hedera transaction that paid the engine for this plan, over x402. */
  plan_receipt: string | null;
  /** The currency the bill was paid in. Shares are in its cents. */
  currency: Currency;
  /** Frozen when confirmations start: US dollars per unit of `currency`. */
  fx_usd_per_unit: number | null;
  fx_as_of: string | null;
  fx_source: string | null;
  /** The HTS token the settlement moves (tUSD on testnet). */
  settle_token: string | null;
  created_at: string;
}

export interface MemberRow {
  id: string;
  group_id: string;
  name: string;
  is_admin: boolean;
  share_cents: number | null;
  /** The share in US cents, fixed when confirmations start. What they pay. */
  settle_usd_cents: number | null;
  confirmed: boolean;
  account_index: number;
  joined_at: string;
}

export class GroupError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o/1/l to misread

function randomId(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function cleanName(input: unknown, max: number): string {
  const name = String(input ?? "").trim().replace(/\s+/g, " ");
  if (name.length === 0) throw new GroupError("A name is required");
  if (name.length > max) throw new GroupError(`Names are at most ${max} characters`);
  return name;
}

// ── reads ────────────────────────────────────────────────────────────────

export async function getGroup(groupId: string): Promise<{ group: GroupRow; members: MemberRow[] }> {
  const db = serverClient();
  const { data: group, error } = await db.from("groups").select("*").eq("id", groupId).maybeSingle();
  if (error) throw new GroupError(error.message, 502);
  if (!group) throw new GroupError("That group does not exist", 404);

  const { data: members, error: mErr } = await db
    .from("members")
    .select("*")
    .eq("group_id", groupId)
    .order("account_index");
  if (mErr) throw new GroupError(mErr.message, 502);

  return { group: group as GroupRow, members: (members ?? []) as MemberRow[] };
}

/** Prove the caller is the member they claim to be. */
async function authenticate(groupId: string, memberId: string, secret: string): Promise<MemberRow> {
  if (!memberId || !secret) throw new GroupError("Sign in to this group first", 401);

  const db = serverClient();
  const { data: row } = await db
    .from("member_secrets")
    .select("secret_hash")
    .eq("member_id", memberId)
    .maybeSingle();

  if (!row || !safeEqual(row.secret_hash as string, hashSecret(secret))) {
    throw new GroupError("That session is not valid for this group", 401);
  }

  const { data: member } = await db.from("members").select("*").eq("id", memberId).maybeSingle();
  if (!member || (member as MemberRow).group_id !== groupId) {
    throw new GroupError("You are not in this group", 403);
  }
  return member as MemberRow;
}

async function authenticateAdmin(groupId: string, memberId: string, secret: string) {
  const member = await authenticate(groupId, memberId, secret);
  if (!member.is_admin) throw new GroupError("Only the group admin can do that", 403);
  return member;
}

function assertOpen(group: GroupRow) {
  if (group.status === "settled") throw new GroupError("This bill is already settled", 409);
  if (group.status === "locked") {
    throw new GroupError("Confirmations are in progress — reopen the split to change it", 409);
  }
}

// ── writes ───────────────────────────────────────────────────────────────

/** Give every member an equal share, in join order. */
async function applyEqualSplit(group: GroupRow, members: MemberRow[]) {
  const db = serverClient();
  const shares = equalShares(group.total_cents, members.map((m) => m.id));
  for (const m of members) {
    const { error } = await db
      .from("members")
      .update({ share_cents: shares.get(m.id) ?? 0, confirmed: false })
      .eq("id", m.id);
    if (error) throw new GroupError(error.message, 502);
  }
}

export async function createGroup(input: {
  adminName?: unknown;
  groupName?: unknown;
  totalCents?: unknown;
  currency?: unknown;
}) {
  if (poolSize() === 0) throw new GroupError("Settlement accounts are not configured", 503);

  const adminName = cleanName(input.adminName, 40);
  const groupName = cleanName(input.groupName, 60);
  const total = input.totalCents;
  const currency = input.currency ?? "MXN";
  if (!isCurrency(currency)) throw new GroupError("The currency must be MXN or USD");
  if (!Number.isInteger(total) || (total as number) < 1 || (total as number) > 10_000_000) {
    throw new GroupError(`The total must be between $0.01 and $100,000.00 ${currency}`);
  }

  const db = serverClient();
  const groupId = randomId(8);
  const memberId = randomId(12);
  const secret = randomBytes(32).toString("hex");

  const { error: gErr } = await db.from("groups").insert({
    id: groupId,
    name: groupName,
    total_cents: total,
    currency,
    payer_id: memberId,
    split_mode: "equal",
    status: "open",
  });
  if (gErr) throw new GroupError(gErr.message, 502);

  const { error: mErr } = await db.from("members").insert({
    id: memberId,
    group_id: groupId,
    name: adminName,
    is_admin: true,
    share_cents: total, // alone at the table, for now
    account_index: 0,
  });
  if (mErr) throw new GroupError(mErr.message, 502);

  const { error: sErr } = await db
    .from("member_secrets")
    .insert({ member_id: memberId, secret_hash: hashSecret(secret) });
  if (sErr) throw new GroupError(sErr.message, 502);

  return { groupId, memberId, secret };
}

export async function joinGroup(groupId: string, rawName: unknown) {
  const name = cleanName(rawName, 40);
  const db = serverClient();

  // Two people can scan the same QR at the same moment and race for a slot.
  // The unique (group_id, account_index) constraint catches it; try again.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { group, members } = await getGroup(groupId);
    assertOpen(group);

    const size = poolSize();
    if (members.length >= size) {
      throw new GroupError(`This group is full — it holds ${size} people`, 409);
    }

    const taken = new Set(members.map((m) => m.account_index));
    let slot = 0;
    while (taken.has(slot)) slot++;

    const memberId = randomId(12);
    const secret = randomBytes(32).toString("hex");

    const { error } = await db.from("members").insert({
      id: memberId,
      group_id: groupId,
      name,
      is_admin: false,
      share_cents: null,
      account_index: slot,
    });

    if (error) {
      if (error.code === "23505") continue; // someone took that slot first
      throw new GroupError(error.message, 502);
    }

    const { error: sErr } = await db
      .from("member_secrets")
      .insert({ member_id: memberId, secret_hash: hashSecret(secret) });
    if (sErr) throw new GroupError(sErr.message, 502);

    // In an equal split a new arrival changes everyone's share.
    if (group.split_mode === "equal") {
      const fresh = await getGroup(groupId);
      await applyEqualSplit(fresh.group, fresh.members);
    }

    return { memberId, secret };
  }

  throw new GroupError("Too many people joined at once — try again", 503);
}

export async function setSplitMode(groupId: string, memberId: string, secret: string, mode: unknown) {
  await authenticateAdmin(groupId, memberId, secret);
  if (mode !== "equal" && mode !== "custom" && mode !== "own") {
    throw new GroupError("Unknown split mode");
  }

  const { group, members } = await getGroup(groupId);
  assertOpen(group);

  const db = serverClient();
  const { error } = await db.from("groups").update({ split_mode: mode }).eq("id", groupId);
  if (error) throw new GroupError(error.message, 502);

  if (mode === "equal") {
    await applyEqualSplit({ ...group, split_mode: mode }, members);
  } else if (mode === "own") {
    // Everyone types what they had. Start from a clean slate.
    const { error: e } = await db
      .from("members")
      .update({ share_cents: null, confirmed: false })
      .eq("group_id", groupId);
    if (e) throw new GroupError(e.message, 502);
  }
  // custom keeps the current numbers as a starting point for the admin.
}

/** The admin sets one person's share (custom mode). */
export async function setShareByAdmin(
  groupId: string,
  memberId: string,
  secret: string,
  targetId: unknown,
  cents: unknown,
) {
  await authenticateAdmin(groupId, memberId, secret);
  const { group, members } = await getGroup(groupId);
  assertOpen(group);
  if (group.split_mode !== "custom") throw new GroupError("Switch to custom amounts first");

  const target = members.find((m) => m.id === targetId);
  if (!target) throw new GroupError("That person is not in this group", 404);
  if (!Number.isInteger(cents) || (cents as number) < 0 || (cents as number) > group.total_cents) {
    throw new GroupError("A share must be between $0.00 and the whole bill");
  }

  const { error } = await serverClient()
    .from("members")
    .update({ share_cents: cents, confirmed: false })
    .eq("id", target.id);
  if (error) throw new GroupError(error.message, 502);
}

/** A member enters what they had (own mode). */
export async function setOwnShare(groupId: string, memberId: string, secret: string, cents: unknown) {
  const me = await authenticate(groupId, memberId, secret);
  const { group } = await getGroup(groupId);
  assertOpen(group);
  if (group.split_mode !== "own") throw new GroupError("The admin has not asked everyone to enter their own");
  if (!Number.isInteger(cents) || (cents as number) < 0 || (cents as number) > group.total_cents) {
    throw new GroupError("Enter an amount between $0.00 and the whole bill");
  }

  const { error } = await serverClient()
    .from("members")
    .update({ share_cents: cents, confirmed: false })
    .eq("id", me.id);
  if (error) throw new GroupError(error.message, 502);
}

/**
 * Freeze the split and put the settlement on chain.
 *
 * From here the amounts are fixed: a single scheduled transaction now holds
 * every payment to the payer, pending until each person who owes has signed.
 */
export async function lockGroup(
  groupId: string,
  memberId: string,
  secret: string,
  /** Absolute URL of the metered engine the plan is bought from. */
  engineUrl: string,
) {
  await authenticateAdmin(groupId, memberId, secret);
  const { group, members } = await getGroup(groupId);
  assertOpen(group);

  if (members.length < 2) throw new GroupError("Invite at least one person before asking for confirmations");

  const check = checkShares(group.total_cents, members);
  if (!check.complete) throw new GroupError("Not everyone's share has been decided yet");
  if (!check.balanced) {
    const off = Math.abs(check.gap) / 100;
    throw new GroupError(
      check.gap > 0
        ? `The shares are $${off.toFixed(2)} short of the bill`
        : `The shares are $${off.toFixed(2)} over the bill`,
    );
  }

  if (!transfersToPayer(group.payer_id, members).length) {
    throw new GroupError("Nobody owes anything — there is nothing to settle");
  }

  // Convert to the dollars that will actually move, at today's rate, once.
  // The rate is frozen on the bill with its date and source, so what each
  // person confirms is the exact dollar amount that settles.
  let rate;
  try {
    rate = await usdRate(group.currency);
  } catch (e) {
    throw new GroupError((e as Error).message, 502);
  }
  const usd = toUsdCents(
    members.map((m) => ({ id: m.id, cents: m.share_cents ?? 0 })),
    rate.usdPerUnit,
  );
  const inDollars = members.map((m) => ({ id: m.id, share_cents: usd.get(m.id) ?? 0 }));
  const owed = transfersToPayer(group.payer_id, inDollars);
  if (owed.length === 0) {
    throw new GroupError("Every share rounds to less than a US cent — there is nothing to settle");
  }

  // Buy the settlement plan from the metered engine, over x402, the same way
  // any other customer would. For one bill with one payer the plan is simply
  // "everyone pays the payer" — there is nothing to compress, and the product
  // says so — but the app still pays for the computation, so every settlement
  // it makes runs through the paid service rather than around it.
  const plan = await fetchPaidPlan(engineUrl, { obligations: owed });
  const transfers = (plan.transfers as Transfer[] | undefined) ?? [];

  // The engine's plan must move exactly what is owed. If it ever disagreed,
  // settling it would charge people amounts they never agreed to.
  const sum = (list: Transfer[]) => list.reduce((a, t) => a + t.cents, 0);
  if (transfers.length === 0 || sum(transfers) !== sum(owed)) {
    throw new GroupError("The settlement plan did not match the shares — nothing was charged", 502);
  }

  const accounts = pool()!;
  const accountMap: Record<string, string> = {};
  for (const m of members) {
    const acct = accounts[m.account_index];
    if (!acct) throw new GroupError("A member has no settlement account", 503);
    accountMap[m.id] = acct.accountId;
  }

  let scheduleId: string;
  try {
    ({ scheduleId } = await scheduleSettlement(transfers, accountMap, `${groupId}-${Date.now().toString(36)}`));
  } catch (e) {
    throw new GroupError(`The settlement could not be put on chain: ${(e as Error).message}`, 502);
  }

  const db = serverClient();
  // The payer receives, and anyone whose share is zero owes nothing: neither
  // has anything to sign, so both count as confirmed from the start.
  const debtors = new Set(transfers.map((t) => t.from));
  for (const m of members) {
    const { error } = await db
      .from("members")
      .update({ confirmed: !debtors.has(m.id), settle_usd_cents: usd.get(m.id) ?? 0 })
      .eq("id", m.id);
    if (error) throw new GroupError(error.message, 502);
  }

  const planReceipt = plan.paid && typeof plan.receipt === "string" ? plan.receipt : null;
  const { error } = await db
    .from("groups")
    .update({
      status: "locked",
      schedule_id: scheduleId,
      plan_receipt: planReceipt,
      fx_usd_per_unit: rate.usdPerUnit,
      fx_as_of: rate.asOf,
      fx_source: rate.source,
      settle_token: settlementToken(),
    })
    .eq("id", groupId);
  if (error) throw new GroupError(error.message, 502);

  return {
    scheduleId,
    planReceipt,
    rate,
    usdCents: Object.fromEntries(usd),
  };
}

/** Throw the pending settlement away and let the split change again. */
export async function reopenGroup(groupId: string, memberId: string, secret: string) {
  await authenticateAdmin(groupId, memberId, secret);
  const { group } = await getGroup(groupId);
  if (group.status === "settled") throw new GroupError("This bill is already settled", 409);
  if (group.status === "open") return;

  const db = serverClient();
  // The abandoned schedule stays pending until it expires. It can never
  // execute without every signature — which is the whole guarantee.
  const { error } = await db
    .from("groups")
    .update({
      status: "open",
      schedule_id: null,
      plan_receipt: null,
      fx_usd_per_unit: null,
      fx_as_of: null,
      fx_source: null,
      settle_token: null,
    })
    .eq("id", groupId);
  if (error) throw new GroupError(error.message, 502);

  const { error: e } = await db
    .from("members")
    .update({ confirmed: false, settle_usd_cents: null })
    .eq("group_id", groupId);
  if (e) throw new GroupError(e.message, 502);
}

/**
 * A person agrees to their share — which means signing the settlement.
 *
 * The confirmation is only recorded AFTER the signature lands on chain. The
 * last signature makes the whole transaction execute.
 */
export async function confirmShare(groupId: string, memberId: string, secret: string) {
  const me = await authenticate(groupId, memberId, secret);
  const { group } = await getGroup(groupId);

  if (group.status === "settled") return { executed: true, scheduleId: group.schedule_id };
  if (group.status !== "locked" || !group.schedule_id) {
    throw new GroupError("The admin has not asked for confirmations yet", 409);
  }
  if (me.confirmed) return { executed: false, scheduleId: group.schedule_id };

  const acct = pool()?.[me.account_index];
  if (!acct) throw new GroupError("Your settlement account is not configured", 503);

  try {
    await signSchedule(group.schedule_id, acct.key, acct.keyType);
  } catch (e) {
    const msg = (e as Error).message;
    // A retry after a signature already landed is not a failure.
    if (!/NO_NEW_VALID_SIGNATURES|SCHEDULE_ALREADY_EXECUTED/.test(msg)) {
      throw new GroupError(`Your signature did not go through: ${msg}`, 502);
    }
  }

  const db = serverClient();
  const { error } = await db.from("members").update({ confirmed: true }).eq("id", me.id);
  if (error) throw new GroupError(error.message, 502);

  const status = await scheduleStatus(group.schedule_id);
  if (status.executed && !status.succeeded) {
    // The last signature arrived but the transfer itself failed. Nobody paid —
    // the transaction is all-or-nothing — so say so, and let the admin reopen.
    throw new GroupError(
      `Everyone confirmed, but the network rejected the payment (${status.result}). Nobody was charged — the admin can reopen and try again.`,
      502,
    );
  }
  if (status.executed) {
    const { error: gErr } = await db.from("groups").update({ status: "settled" }).eq("id", groupId);
    if (gErr) throw new GroupError(gErr.message, 502);
  }

  return { executed: status.executed, scheduleId: group.schedule_id };
}
