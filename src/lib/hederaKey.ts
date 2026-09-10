import type { PrivateKey as PrivateKeyType } from "@hashgraph/sdk";

/**
 * The Hedera portal hands out several representations of the same key — DER,
 * raw hex, ED25519, ECDSA. Accept any of them rather than making the operator
 * work out which one the SDK wanted.
 */
export async function parseOperatorKey(raw: string | undefined): Promise<PrivateKeyType> {
  const value = String(raw ?? "").trim().replace(/^0x/, "");
  if (!value) throw new Error("HEDERA_OPERATOR_KEY is empty");

  const { PrivateKey } = await import("@hashgraph/sdk");

  const attempts = [
    () => PrivateKey.fromStringDer(value),
    () => PrivateKey.fromStringED25519(value),
    () => PrivateKey.fromStringECDSA(value),
  ];

  for (const parse of attempts) {
    try {
      return parse();
    } catch {
      // try the next representation
    }
  }

  throw new Error(
    "Could not read HEDERA_OPERATOR_KEY — copy the DER Encoded Private Key from portal.hedera.com",
  );
}
