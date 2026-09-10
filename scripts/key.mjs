import { readFileSync } from "node:fs";
import { PrivateKey } from "@hashgraph/sdk";

/**
 * The Hedera portal hands out several representations of the same key — DER,
 * raw hex, ED25519, ECDSA — and picking the wrong one fails with a parser
 * error that says nothing useful. Try them all instead of making the reader
 * guess.
 */
export function parseKey(raw) {
  const value = String(raw ?? "").trim().replace(/^0x/, "");
  if (!value) throw new Error("HEDERA_OPERATOR_KEY is empty");

  const attempts = [
    ["DER", () => PrivateKey.fromStringDer(value)],
    ["ED25519", () => PrivateKey.fromStringED25519(value)],
    ["ECDSA", () => PrivateKey.fromStringECDSA(value)],
  ];

  for (const [, parse] of attempts) {
    try {
      return parse();
    } catch {
      // try the next representation
    }
  }

  throw new Error(
    "Could not read HEDERA_OPERATOR_KEY. Copy the DER Encoded Private Key " +
      "from portal.hedera.com — not the mnemonic, and not the public key.",
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
