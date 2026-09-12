import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Two clients, one key, different powers.
 *
 * Both use the PUBLIC publishable key. What separates them is the
 * x-squash-token header: row-level security only lets a request write when the
 * SHA-256 of that header matches the hash baked into the database. The browser
 * client never has the token, so it can read a group — which is the whole
 * point of an invitation QR — and nothing more.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let browser: SupabaseClient | null = null;

/** Read-only, for the browser. Subscribes to live changes. */
export function browserClient(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Supabase is not configured");
  if (!browser) {
    browser = createClient(url, anonKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return browser;
}

/**
 * The server's client. Carries the write token, so it must never run in a
 * browser — the guard below fails loudly rather than leaking it.
 */
export function serverClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("serverClient() must never run in the browser");
  }
  const token = process.env.SQUASH_WRITE_TOKEN;
  if (!url || !anonKey || !token) throw new Error("Supabase server access is not configured");

  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { "x-squash-token": token } },
  });
}
