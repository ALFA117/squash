# Status — 9 September 2026, 21:30 CST

Submissions close **Sunday 13 September, 10:00**. Roughly 3½ days left.

This file is the honest ledger: what runs, what is written but never executed,
and what has not been started. Nothing here is aspirational.

---

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

## Written but never executed

**`src/lib/scheduled.ts` is dead code.** Nothing imports it. `/sign` simulates
the whole thing: it holds a `useState`, waits 450 ms and navigates to `/done`.
No scheduled transaction is ever created.

This matters more than a missing feature. It is **the one place where the pitch
claims something the code does not do** — "nobody pays until everybody
confirms, it is a property of the transaction, not a promise of the app" is,
today, exactly a promise of the app.

Two ways out, and one has to be picked:

- **Build it** (~3–4 h): create the scheduled transfer, have each debited party
  sign it, let the last signature trigger execution. Needs one testnet account
  per signer, which `scripts/create-agent.mjs` can mint.
- **Soften the copy** so nothing is claimed that is not done.

Building it is the better answer — it is the strongest argument in the deck and
the reason to be on Hedera rather than anywhere else.

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

1. **Thu am** — Scheduled Transactions for real. Closes the integrity gap.
2. **Thu pm** — Privy. Cheapest hours-per-dollar; its track describes this app.
3. **Fri** — World, if sandbox access arrived. If not, ship with two SDKs.
4. **Sat** — video, description, diagram. Submit Saturday night.

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
- `/done` shows a "demo run" line instead of an explorer link, because no
  settlement receipt exists yet. That is correct: it will show a real link the
  moment scheduled settlement lands, and it never invents a hash.
