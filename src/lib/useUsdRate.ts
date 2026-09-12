"use client";

import { useEffect, useState } from "react";
import type { Currency } from "./money";

export interface LiveRate {
  usdPerUnit: number;
  asOf: string;
  source: string;
}

/**
 * Today's rate to US dollars, for showing an estimate before a bill is
 * locked. Only an estimate: the rate that counts is the one frozen on the
 * bill when confirmations start.
 */
export function useUsdRate(currency: Currency | null | undefined): LiveRate | null {
  const [rate, setRate] = useState<LiveRate | null>(null);
  useEffect(() => {
    if (!currency) return;
    if (currency === "USD") {
      setRate({ usdPerUnit: 1, asOf: "", source: "par" });
      return;
    }
    let live = true;
    setRate(null);
    fetch(`/api/fx?currency=${currency}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d?.usdPerUnit > 0) setRate(d as LiveRate);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [currency]);
  return rate;
}
