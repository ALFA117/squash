# Status — 12 September 2026

Submissions close **Sunday 13 September, 10:00**. Roughly 3½ days left.

This file is the honest ledger: what runs, what is demo-shaped, and what has
not been started. Nothing here is aspirational.

---

## 12 September — what changed

Other agents broke settlement in production on 10-11 Sep (see
CONTINUACION.md, section 0). Repaired and re-verified the same day. Then the
real product flow was built: **split a bill at the table**, joined by a real
QR, live across phones, split three ways, paid only when everyone says yes.

`node scripts/test-dinner.mjs https://squash-pay.vercel.app` — 27 checks
against production including five attacks. All pass.

## Works today, verifiable by anyone

| | Evidence |
|---|---|
| Netting engine with a **proven minimum** solver | `src/lib/netting.ts`, 15 tests |
| Metered endpoint, priced per obligation | `POST /api/v1/net` |
| x402 gate, Hedera `exact` scheme via Blocky402 | `src/lib/x402.ts` |
| An agent completing a **real paid request** | [tx `0.0.7162784@1789008230.889484170`](https://hashscan.io/testnet/transaction/0.0.7162784-1789008230-889484170) |
| The app paying the engine on the server's behalf | `/api/plan`, live |
| Proof of each run published to HCS | [topic `0.0.10452145`](https://hashscan.io/testnet/topic/0.0.10452145) |
| Six screens, end to end | <https://squash-pay.vercel.app> |

The payment transaction is worth opening. The agent spent 525,000 tinybars on
the work and **nothing** on gas — the facilitator paid the 261,818-tinybar
network fee. Paying for a service without holding the network's token is the
claim this project makes, and it is on chain.

### Accounts in play (testnet only)

| Role | Account |
|---|---|
| The engine, receiving payment | `0.0.10450391` |
| The agent / the app, paying | `0.0.10452163` |
| Facilitator fee payer (Blocky402, not ours) | `0.0.7162784` |
| HCS topic for run proofs | `0.0.10452145` |

Keys live only in `.env.local`, which is gitignored. Everything is testnet;
the faucet funds it for free, so the build has cost nothing.

---

## Settlement is real now

`/sign` puts the whole plan on chain as ONE scheduled transaction — every
debit and every credit in a single transfer list — and it sits pending until
each debited account has signed. Watched live: Diego signs, still pending;
Luis signs, still pending; you sign, and it **executes**.

Verified against the mirror node, twice, to the tinybar:

```
tu       -204,000      rosa     +204,000
diego    -111,000      mariana  +111,000
luis      -57,000      ana       +57,000
```

The debtors paid their amount and nothing else — the operator covered the
network fees, so nobody needed gas to settle.

"Nobody pays until everybody confirms" is no longer a promise the app makes.
The transaction cannot go through until it is complete.

Two things that bite and are now handled: the same plan produces a
byte-identical transaction every time, and Hedera refuses to create one that
duplicates a schedule it still remembers — including one that already
executed — so each attempt carries its own nonce in the memo; and repeating
the same nonce stays idempotent, which is what makes a reload mid-signing
harmless.

**Still a demo in one respect:** the six people are throwaway testnet accounts
whose keys the app holds (`scripts/create-demo-accounts.mjs`). That is exactly
what Privy replaces — real per-user wallets the app never sees.

---

## Not started

| Work | Prize | Blocked on |
|---|---|---|
| **Privy** embedded wallets | $2,500, 1 winner | an App ID from dashboard.privy.io |
| **World** Selfie Check | $3,500, 3 winners | an App ID **and** the sandbox access form |
| Demo video, ≤5 min | required by every track | has to be recorded by a human |
| Submission description, English | required | — |
| Architecture diagram | Hedera asks for one; today it is prose | — |
| World feedback document | required if World is attempted | World access |

The event allows **up to three** sponsor SDKs. One is integrated. Two SDKs is a
perfectly good submission — a tight project beats a padded one.

The World sandbox form is the same shape of trap that got Chainlink cut from
the plan: an external approval with unknown latency on the critical path. If it
is going to be attempted, the form goes in today, and there is a hard decision
point on Friday night.

---

## Owned by a human, not by code

- Create the project in the ETHGlobal dashboard, track **Building from Scratch**
- **Check-in #2 — due Thursday 10 September, 21:59**
- Connect the event Discord
- Record the demo video
- Submit — **Saturday night, not Sunday.** The 10:00 deadline is in another
  timezone and there is no reason to find out which one at 09:45.

---

## Suggested order

1. **Thu** — Privy. Cheapest hours-per-dollar, and its track describes this
   app exactly. It also removes the last thing that is demo-shaped: the app
   holding six people's keys.
2. **Fri** — World, if sandbox access arrived. If not, ship with two SDKs.
3. **Sat** — video, description, diagram. Submit Saturday night.

Cut order when something slips: World first, then Privy. The last thing to
touch is the video — a project without one does not exist to a judge.

---

## Known rough edges

- `npm audit` reports 5 vulnerabilities, all inside vitest's dependency tree.
  Dev-only, never shipped. An upgrade hit a peer-dependency conflict and was
  left alone deliberately.
- The plan takes ~10 s on a cold request because the app is really paying for
  it. The loading state says so rather than looking like a hang. Repeat loads
  hit a 5-minute cache and are instant.
- `/sign` takes ~15 s before its button goes live: it creates the scheduled
  transaction and then the other two debtors sign, each a real transaction
  landing one at a time. The list fills in as they do, which is the part worth
  filming.
- `/done` only links to the explorer when it was reached through an actual
  settlement. Opened directly it says so instead of inventing a hash.
