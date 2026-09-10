import type { PrivateKey as PrivateKeyType } from "@hashgraph/sdk";

/**
 * The Hedera portal hands out the same key in several representations — DER,
 * raw hex — for two different curves. A raw 32-byte hex string parses happily
 * as EITHER ED25519 or ECDSA, and picking the wrong one produces a key that
 * signs perfectly and is rejected by the network. So an explicit
 * HEDERA_KEY_TYPE wins whenever it is set.
 */
export async function parseOperatorKey(
  raw: string | undefined,
  type: string | undefined = process.env.HEDERA_KEY_TYPE,
): Promise<PrivateKeyType> {
  const value = String(raw ?? "").trim().replace(/^0x/, "");
  if (!value) throw new Error("HEDERA_OPERATOR_KEY is empty");

  const { PrivateKey } = await import("@hashgraph/sdk");

  const declared = String(type ?? "").trim().toUpperCase();
  if (declared === "ECDSA") return PrivateKey.fromStringECDSA(value);
  if (declared === "ED25519") return PrivateKey.fromStringED25519(value);

  // DER carries its own curve marker, so it is unambiguous.
  try {
    return PrivateKey.fromStringDer(value);
  } catch {
    throw new Error(
      "HEDERA_KEY_TYPE must be ECDSA or ED25519 when the key is raw hex — a hex key parses as either curve and only one is right.",
    );
  }
}
