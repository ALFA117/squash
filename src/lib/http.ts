/**
 * fetch with a deadline, for the browser.
 *
 * Every action in the app ends in a real network call — some of them wait on
 * Hedera. Without a deadline a stalled request leaves a spinner turning
 * forever, which in a demo reads as "the app froze". With one, the person
 * gets a message and a button that works again.
 */
export class SlowError extends Error {
  constructor() {
    super("timeout");
    this.name = "SlowError";
  }
}

export async function fetchWithin(url: string, init: RequestInit = {}, ms = 60_000): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    const name = (e as Error).name;
    if (name === "TimeoutError" || name === "AbortError") throw new SlowError();
    throw new Error("offline");
  }
}

/** A message a person can act on, in their language. */
export function explain(e: unknown, t: (en: string, es: string) => string): string {
  const err = e as Error;
  if (err?.name === "SlowError") {
    return t(
      "The network is taking too long. Nothing was charged twice — try again.",
      "La red está tardando demasiado. No se cobró nada dos veces — vuelve a intentarlo.",
    );
  }
  if (err?.message === "offline") {
    return t(
      "No connection to the server. Check your internet and try again.",
      "Sin conexión con el servidor. Revisa tu internet y vuelve a intentarlo.",
    );
  }
  return err?.message || t("Something went wrong — try again.", "Algo salió mal — vuelve a intentarlo.");
}
