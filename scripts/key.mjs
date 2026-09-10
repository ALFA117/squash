import { readFileSync } from "node:fs";
import { PrivateKey } from "@hashgraph/sdk";

/**
 * The Hedera portal hands out the same key in several representations — DER,
 * raw hex — for two different curves. A raw 32-byte hex string parses happily
 * as EITHER ED25519 or ECDSA, and picking the wrong one produces a key that
 * signs perfectly and is rejected by the network, which is a miserable thing
 * to debug. So an explicit HEDERA_KEY_TYPE wins whenever it is set; the
 * portal tells you which kind of account you made.
 */
export function parseKey(raw, type = process.env.HEDERA_KEY_TYPE) {
  const value = String(raw ?? "").trim().replace(/^0x/, "");
  if (!value) throw new Error("HEDERA_OPERATOR_KEY is empty");

  const declared = String(type ?? "").trim().toUpperCase();
  if (declared === "ECDSA") return PrivateKey.fromStringECDSA(value);
  if (declared === "ED25519") return PrivateKey.fromStringED25519(value);

  // DER carries its own curve marker, so it is unambiguous and goes first.
  try {
    return PrivateKey.fromStringDer(value);
  } catch {
    // not DER
  }

  throw new Error(
    "HEDERA_KEY_TYPE must be ECDSA or ED25519 when the key is raw hex — a hex " +
      "key parses as either curve and only one is right. The Hedera portal " +
      "shows which kind of account you created.",
  );
}

/** Load .env.local without pulling in a dependency for it. */
export function loadEnv(url) {
  try {
    for (const line of readFileSync(url, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env.local — rely on the ambient environment
  }
}
