import { createHash } from "node:crypto";
import type { NetResult, Obligation } from "./netting";

/**
 * Proof-of-run on the Hedera Consensus Service.
 *
 * Every netting run publishes the hash of its inputs alongside the plan it
 * produced. That is what makes the compression auditable rather than a claim:
 * anyone holding the same obligations can recompute the hash, find the message
 * on the topic, and check that we did not quietly drop or invent a debt.
 *
 * Publishing is best-effort. A topic that is unreachable must never cost the
 * caller their answer, so failures are reported, not thrown.
 */

export interface RunProof {
  inputHash: string;
  obligations: number;
  transfers: number;
  compression: number;
  optimal: boolean;
  publishedAt: string;
  topicId?: string;
  sequenceNumber?: string;
  error?: string;
}

/**
 * Canonical hash of the inputs. Sorted so that the same set of obligations
 * always hashes identically regardless of the order they arrived in.
 */
export function hashObligations(obligations: Obligation[]): string {
  const canonical = obligations
    .map((o) => `${o.from}>${o.to}:${o.cents}`)
    .sort()
    .join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

function configured(): boolean {
  return Boolean(process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY);
}

export async function publishProof(
  obligations: Obligation[],
  result: NetResult,
): Promise<RunProof> {
  const proof: RunProof = {
    inputHash: hashObligations(obligations),
    obligations: result.grossEdges.length,
    transfers: result.transfers.length,
    compression: result.compression,
    optimal: result.optimal,
    publishedAt: new Date().toISOString(),
  };

  const topicId = process.env.HEDERA_HCS_TOPIC_ID;
  if (!configured() || !topicId) {
    proof.error = "HCS not configured — set HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY and HEDERA_HCS_TOPIC_ID";
    return proof;
  }

  try {
    const { Client, PrivateKey, TopicMessageSubmitTransaction } = await import("@hashgraph/sdk");

    const client =
      process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
    client.setOperator(
      process.env.HEDERA_OPERATOR_ID!,
      PrivateKey.fromStringDer(process.env.HEDERA_OPERATOR_KEY!),
    );

    const receipt = await new TopicMessageSubmitTransaction({
      topicId,
      message: JSON.stringify({
        v: 1,
        inputHash: proof.inputHash,
        obligations: proof.obligations,
        transfers: proof.transfers,
        compression: Number(proof.compression.toFixed(4)),
        optimal: proof.optimal,
        plan: result.transfers.map((t) => `${t.from}>${t.to}:${t.cents}`),
      }),
    })
      .execute(client)
      .then((tx) => tx.getReceipt(client));

    proof.topicId = topicId;
    proof.sequenceNumber = receipt.topicSequenceNumber?.toString();
    client.close();
  } catch (e) {
    proof.error = (e as Error).message;
  }

  return proof;
}
