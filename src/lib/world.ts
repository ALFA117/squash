/**
 * World ID — Selfie Check — as a seat's proof that it is one real person.
 *
 * Squash uses it for the two things a table of strangers-with-a-link can
 * abuse: seats and continuity.
 *
 *  - Fairness: with "verified people only", every seat is a live human, and
 *    one human gets one seat per bill. The action is scoped to the bill, so
 *    World returns the same nullifier for the same person at the same table
 *    and a different one anywhere else — a duplicate seat is refused, and
 *    nobody can be tracked across bills.
 *  - Continuity: someone who loses their seat (new phone, cleared browser)
 *    gets it back by passing Selfie Check again — same person, same
 *    nullifier, same seat — without asking the admin.
 *
 * The nullifier is kept server-side next to the seat's secret, in a table
 * no browser can read; everyone else only sees "verified".
 *
 * Off unless the Developer Portal credentials are set.
 */
import { createHash } from "node:crypto";
import { signRequest } from "@worldcoin/idkit-server";

const VERIFY = "https://developer.world.org/api/v4/verify";

/**
 * Demo mode: while World has not enabled Selfie Check for this app, the World
 * App step is SIMULATED on screen (clearly labelled "demo") and accepted here
 * only when WORLD_DEMO=1. Everything around it — one seat per person per
 * table, "verified people only", getting a seat back — runs for real on the
 * simulated identity. A simulated nullifier is prefixed "demo:" so it can
 * never be mistaken for, or collide with, a real one.
 */
export function worldDemo(): boolean {
  return process.env.WORLD_DEMO === "1";
}

export function worldConfigured(): boolean {
  return (
    worldDemo() ||
    Boolean(process.env.NEXT_PUBLIC_WORLD_APP_ID && process.env.WORLD_RP_ID && process.env.WORLD_RP_SIGNING_KEY)
  );
}

/** One action per bill: one nullifier per person per table. */
export function seatAction(groupId: string): string {
  return `squash-seat-${groupId}`;
}

/** The signed request context the World ID widget needs. */
export function rpContext(action: string) {
  if (!worldConfigured()) throw new Error("World ID is not configured");
  const s = signRequest({ signingKeyHex: process.env.WORLD_RP_SIGNING_KEY!, action, ttl: 300 });
  return {
    rp_id: process.env.WORLD_RP_ID!,
    nonce: s.nonce,
    created_at: s.createdAt,
    expires_at: s.expiresAt,
    signature: s.sig,
  };
}

/**
 * Check a World ID result with the Developer Portal and return its nullifier.
 * The result is forwarded exactly as the widget produced it.
 */
export async function verifyHuman(result: unknown, action: string): Promise<string> {
  if (!worldConfigured()) throw new Error("World ID is not configured");
  if (!result || typeof result !== "object") throw new Error("Missing World ID proof");

  const demo = result as { demo?: unknown; subject?: unknown };
  if (demo.demo === true) {
    if (!worldDemo()) throw new Error("Simulated proofs are not accepted on this server");
    if (typeof demo.subject !== "string" || !/^[a-f0-9]{64}$/.test(demo.subject)) {
      throw new Error("Malformed simulated proof");
    }
    // Same simulated person + same table → same nullifier, like the real thing.
    return "demo:" + createHash("sha256").update(`${demo.subject}:${action}`).digest("hex");
  }

  const res = await fetch(`${VERIFY}/${process.env.WORLD_RP_ID}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(result),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    nullifier?: string;
    action?: string;
    detail?: string;
    code?: string;
    results?: { success?: boolean; nullifier?: string }[];
  };
  if (!res.ok || !data.success) {
    throw new Error(data.detail || data.code || `World ID could not verify this person (${res.status})`);
  }
  if (data.action && data.action !== action) throw new Error("That proof was made for a different table");
  const nullifier = data.nullifier ?? data.results?.find((r) => r.success)?.nullifier;
  if (!nullifier) throw new Error("World ID returned no nullifier");
  return nullifier.toLowerCase();
}
