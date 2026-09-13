"use client";

import { PrivyProvider, usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { defineChain, encodeFunctionData, parseAbi } from "viem";
import { useLocale } from "./Locale";
import { formatUsd } from "@/lib/money";

/**
 * Where the person who paid gets paid: their own wallet, made from an email.
 *
 * Privy creates an embedded wallet at sign-in — a key the app never sees.
 * On Hedera its address is an account; the bill settles into it, and from
 * the same screen the money can be sent on, signed by that wallet and sent
 * through Hedera's EVM relay. Nobody is asked about seed phrases, chains or
 * gas, and the words never appear.
 *
 * This whole module — Privy included — loads only when the payer opens it,
 * so it can never slow down or stall the rest of the app.
 */

const hederaTestnet = defineChain({
  id: 296,
  name: "Hedera Testnet",
  network: "hedera-testnet",
  nativeCurrency: { decimals: 18, name: "HBAR", symbol: "HBAR" },
  rpcUrls: {
    default: { http: ["https://testnet.hashio.io/api"], webSocket: ["wss://testnet.hashio.io/api"] },
  },
  blockExplorers: { default: { name: "HashScan", url: "https://hashscan.io/testnet" } },
});

const TOKEN_ID = process.env.NEXT_PUBLIC_SETTLEMENT_TOKEN_ID || "0.0.10511085";
const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";
const ERC20 = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);

/** 0.0.N → Hedera's EVM address for it. */
function longZero(id: string) {
  return ("0x" + Number(id.split(".").pop()).toString(16).padStart(40, "0")) as `0x${string}`;
}

function toAddress(input: string): `0x${string}` | null {
  const v = input.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) return v as `0x${string}`;
  if (/^0\.0\.\d+$/.test(v)) return longZero(v);
  return null;
}

export interface PayoutProps {
  status: "open" | "locked" | "settled";
  payoutEvm: string | null;
  payoutAccount: string | null;
  onConnect: (evm: string) => Promise<boolean>;
}

export default function PayoutWallet(props: PayoutProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const { t } = useLocale();
  if (!appId) {
    return <p className="room-note">{t("Wallet sign-in is not configured.", "El acceso con cartera no está configurado.")}</p>;
  }
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google"],
        appearance: { theme: "light", accentColor: "#1b8058", logo: "/brand/logo.png", showWalletLoginFirst: false },
        embeddedWallets: { ethereum: { createOnLogin: "all-users" } },
        defaultChain: hederaTestnet,
        supportedChains: [hederaTestnet],
      }}
    >
      <Inner {...props} />
    </PrivyProvider>
  );
}

function Inner({ status, payoutEvm, payoutAccount, onConnect }: PayoutProps) {
  const { t } = useLocale();
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const embedded = wallets.find((w) => w.walletClientType === "privy");
  const address = embedded?.address?.toLowerCase() ?? null;

  const [linking, setLinking] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Signed in, wallet ready, bill still open: this wallet is where the money goes.
  useEffect(() => {
    if (!address || status !== "open" || payoutEvm === address || linking) return;
    setLinking(true);
    setError(null);
    onConnect(address).finally(() => setLinking(false));
  }, [address, status, payoutEvm, linking, onConnect]);

  // What the wallet holds, in dollars.
  useEffect(() => {
    if (!payoutAccount) return;
    let live = true;
    const read = () =>
      fetch(`${MIRROR}/accounts/${payoutAccount}/tokens?token.id=${TOKEN_ID}`)
        .then((r) => r.json())
        .then((d) => live && setBalance(d.tokens?.[0]?.balance ?? 0))
        .catch(() => {});
    read();
    const every = setInterval(read, 6000);
    return () => {
      live = false;
      clearInterval(every);
    };
  }, [payoutAccount, sent]);

  const linked = !!payoutEvm && payoutEvm === address;
  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const dest = toAddress(to);
    const cents = Math.round(Number(amount) * 100);
    if (!dest || !(cents > 0) || !address) return;
    setSending(true);
    setError(null);
    setSent(null);
    try {
      const { hash } = await sendTransaction(
        {
          to: longZero(TOKEN_ID),
          data: encodeFunctionData({ abi: ERC20, functionName: "transfer", args: [dest, BigInt(cents)] }),
          chainId: 296,
          gasLimit: 120_000,
        },
        { address: embedded!.address, uiOptions: { showWalletUIs: false } },
      );
      setSent(hash);
      setAmount("");
    } catch (err) {
      setError((err as Error).message?.slice(0, 180) || t("It did not go through.", "No se pudo enviar."));
    } finally {
      setSending(false);
    }
  }

  if (!ready) {
    return <p className="wallet-note">{t("Opening your wallet…", "Abriendo tu cartera…")}</p>;
  }

  if (!authenticated) {
    return (
      <div className="wallet-body">
        <p className="wallet-note">
          {t(
            "Sign in with your email and the money you are owed lands in your own wallet — not in an account the app holds. No passwords, no seed phrases.",
            "Entra con tu correo y el dinero que te deben llega a tu propia cartera — no a una cuenta que tenga la app. Sin contraseñas ni frases secretas.",
          )}
        </p>
        <button type="button" className="btn btn-dark" onClick={login} disabled={status !== "open"}>
          {t("Get paid in my wallet", "Recibir en mi cartera")}
        </button>
        {status !== "open" && (
          <p className="wallet-note">{t("Choose this before asking for confirmations.", "Esto se elige antes de pedir confirmaciones.")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="wallet-body">
      <div className="wallet-line">
        <span className="grow">
          {user?.email?.address ?? user?.google?.email ?? t("Signed in", "Sesión iniciada")}
        </span>
        <button type="button" className="link-button" onClick={logout}>
          {t("Sign out", "Salir")}
        </button>
      </div>

      {!address ? (
        <p className="wallet-note">{t("Creating your wallet…", "Creando tu cartera…")}</p>
      ) : linking ? (
        <p className="wallet-note">{t("Preparing your wallet on Hedera…", "Preparando tu cartera en Hedera…")}</p>
      ) : linked ? (
        <p className="wallet-ok">
          {status === "settled"
            ? t("You were paid here", "Aquí te pagaron")
            : t("The money you are owed will land here", "Aquí te va a llegar lo que te deben")}{" "}
          · <span className="money">{short(address)}</span>
        </p>
      ) : status !== "open" ? (
        <p className="wallet-note">
          {t("This bill pays the table's test account; your wallet was not chosen in time.", "Esta cuenta paga a la cuenta de prueba de la mesa; tu cartera no se eligió a tiempo.")}
        </p>
      ) : null}

      {linked && payoutAccount && (
        <div className="wallet-balance">
          <span className="label">{t("IN YOUR WALLET", "EN TU CARTERA")}</span>
          <strong className="money">{balance === null ? "—" : formatUsd(balance)}</strong>
          <a className="receipt-link" href={`https://hashscan.io/testnet/account/${payoutAccount}`} target="_blank" rel="noreferrer">
            {payoutAccount} ↗
          </a>
        </div>
      )}

      {linked && status === "settled" && (
        <form className="wallet-send" onSubmit={send}>
          <span className="label">{t("SEND IT ON", "ENVIARLO")}</span>
          <input
            className="text-input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={t("To: 0.0.12345 or 0x…", "A: 0.0.12345 o 0x…")}
            aria-label={t("Send to", "Enviar a")}
          />
          <div className="own-share-row">
            <span className="money-input">
              <span aria-hidden="true">US$</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="1.00"
                aria-label={t("Amount in dollars", "Monto en dólares")}
              />
            </span>
            <button type="submit" className="btn btn-dark btn-inline" disabled={sending || !toAddress(to) || !(Number(amount) > 0)}>
              {sending ? t("Sending…", "Enviando…") : t("Send", "Enviar")}
            </button>
          </div>
          {sent && (
            <a className="receipt plan-receipt" href={`https://hashscan.io/testnet/transaction/${sent}`} target="_blank" rel="noreferrer">
              <span className="grow">{t("Sent from your wallet", "Enviado desde tu cartera")}</span>
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </form>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
