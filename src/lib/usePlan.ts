"use client";

import { useEffect, useState } from "react";
import type { Transfer } from "./netting";

export interface PlanResponse {
  balances: Record<string, number>;
  grossEdges: Array<{ from: string; to: string; cents: number }>;
  transfers: Transfer[];
  optimal: boolean;
  compression: number;
  price: { obligations: number; hbar: string; unitHbar: string };
  paid: boolean;
  gated: boolean;
  cached?: boolean;
  reason?: string;
  receipt?: string;
  proof?: { inputHash: string; topicId?: string; sequenceNumber?: string; error?: string };
}

/**
 * Every screen that shows the plan asks the engine over HTTP rather than
 * importing it, so the paid path is the one the UI actually exercises.
 */
export function usePlan() {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // The app's own endpoint, which pays the engine on the server's behalf.
    // The browser holds no key and never speaks x402 directly.
    fetch("/api/plan")
      .then(async (r) => {
        if (!r.ok) throw new Error(`El motor respondió ${r.status}`);
        return (await r.json()) as PlanResponse;
      })
      .then((data) => {
        if (!cancelled) setPlan(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { plan, error };
}
