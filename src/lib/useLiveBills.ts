"use client";

import { useEffect, useState } from "react";
import { fetchWithin } from "./http";

export type LiveBills = "checking" | "live" | "offline";

// One check per page load, shared by every component that asks.
let pending: Promise<LiveBills> | null = null;

function check(): Promise<LiveBills> {
  if (!pending) {
    pending = fetchWithin("/api/groups", { cache: "no-store" }, 8_000)
      .then(async (r) => ((await r.json()) as { live?: boolean }).live === false ? "offline" : "live")
      // If the status light itself cannot be reached, do not block anyone:
      // the bill form still explains any failure when it is sent.
      .catch((): LiveBills => "live");
  }
  return pending;
}

/**
 * Whether live bills (QR, shared table, realtime) can be served right now.
 * The sample trip does not depend on this: it runs on Hedera testnet alone.
 */
export function useLiveBills(): LiveBills {
  const [state, setState] = useState<LiveBills>("checking");
  useEffect(() => {
    let alive = true;
    void check().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
