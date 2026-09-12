"use client";

import { useEffect, useState } from "react";
import type { Transfer, Expense } from "./netting";

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
export function usePlan(expenses: Expense[]) {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Every fetch here spends the app's balance buying a netting run. Keying the
  // effect on the CONTENT rather than the array reference means a re-render
  // that hands over an equal-but-new array does not buy the same plan twice.
  const key = JSON.stringify(expenses);

  useEffect(() => {
    if (expenses.length === 0) return;

    let cancelled = false;

    // The app's own endpoint, which pays the engine on the server's behalf.
    // The browser holds no key and never speaks x402 directly.
    fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expenses }),
    })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content
  }, [key]);

  return { plan, error };
}
