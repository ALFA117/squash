# Squash — git squash, but for money

**Live:** <https://squash-pay.vercel.app> · **Code:** <https://github.com/ALFA117/squash>

## Elevator pitch

Six friends, one restaurant bill, one card. Squash turns "I'll pay you back
later" into a single payment that **cannot execute until everyone at the table
has said yes** — enforced by the transaction itself, on Hedera. The bill is in
pesos; what moves is **dollars, converted at today's rate** and settled as a
Hedera token.

And when a group has been paying for each other for a whole trip, it
compresses the tangle to the **provable minimum** number of transfers:

```
15 obligations between 6 people  →  3 transfers  ·  80% fewer
```

## Try it — about a minute

1. Open <https://squash-pay.vercel.app/nuevo>. Enter your name and a bill, say $2,500 MXN — it shows the dollar estimate live.
2. You get a **real QR**. Open it on a second device (or a **private window** — the same browser is already you) and join as someone else.
3. Watch the first screen update **live** as people join.
4. As admin, pick how to split: **equal parts**, **you set the amounts**, or **each enters their own**.
5. Tap **Ask everyone to confirm**. Every share is converted to US dollars at today's rate, which is frozen on the bill. The app **pays the netting engine over x402** for the plan, then puts the settlement on chain, pending. The table shows the rate, the dollar token and the x402 payment, each with a link.
6. Each person taps **Yes, I pay US$…**. The last one executes it. Open the receipt: the transfers are in tUSD.

## Don't take our word for it

Every claim below links to the chain.

| Claim | Proof |
|---|---|
| A bill split at a table, settled only after the last "yes" | [schedule `0.0.10510230`](https://hashscan.io/testnet/schedule/0.0.10510230) — Diego −$600, Luis −$600, Rosa +$1,200 |
| A custom split, exactly as the admin set it | [schedule `0.0.10510081`](https://hashscan.io/testnet/schedule/0.0.10510081) — Diego −$1,000, Luis −$500, Rosa +$1,500 |
| A $1,500 MXN split settled as **US$88.40 in tUSD** at the day's rate (Diego −58.93, Luis −29.47, Rosa +88.40) | [transfer](https://hashscan.io/testnet/transaction/0.0.10450391-1789253509-329841529) · [schedule `0.0.10511795`](https://hashscan.io/testnet/schedule/0.0.10511795) · [token `0.0.10511085`](https://hashscan.io/testnet/token/0.0.10511085) |
| Locking a bill **buys its plan from the engine over x402** — agent → engine, fee sponsored by Blocky402 — and only then schedules it | [x402 payment `0.0.7162784@1789249485.560257425`](https://hashscan.io/testnet/transaction/0.0.7162784-1789249485-560257425) → [schedule `0.0.10510675`](https://hashscan.io/testnet/schedule/0.0.10510675), executed |
| An agent paid for a netting run over x402, and **spent nothing on gas** | [tx `0.0.7162784@1789008230.889484170`](https://hashscan.io/testnet/transaction/0.0.7162784-1789008230-889484170) |
| Each run's inputs and plan are published, so anyone can recompute it | [HCS topic `0.0.10452145`](https://hashscan.io/testnet/topic/0.0.10452145) |

## Why Hedera

The promise is *nobody pays until everyone confirms*. On most chains that is
a promise the app keeps. On Hedera it is a property of the transaction: all
the payments go into **one scheduled transaction** that simply cannot execute
until every required signature is present. If one person never says yes, no
money moves — for anyone.

The dollars are native too: **tUSD is an HTS token** with two decimals, so one
unit is one US cent and the conversion is exact. On mainnet the same code
settles in USDC, which is also an HTS token.

The x402 facilitator also **sponsors the network fee**, so whoever pays for a
computation does not need to hold HBAR.

## How it works

**At the table.** Whoever paid opens the bill and is the admin. A QR carries
the group's link; each person scans in and sees their share. The admin
chooses the split. When it adds up to the bill exactly, every share is
converted to US cents at today's rate (open.er-api.com, with the ECB feed as
fallback — never a made-up rate), frozen on the bill, and rounded so the
dollar shares still add up to the converted total. The app buys the
settlement plan from the netting engine over x402, checks it adds up to the
shares, and confirmations open —
and the split **freezes**, because the settlement already exists on chain with
those amounts. Changing it means reopening, which abandons the pending
transaction and clears every confirmation. Nobody can agree to one number and
pay another.

**Across a trip.** When several people paid for different things, the debts
cross. The engine finds the minimum: every settlement plan decomposes into
groups that sum to zero, and a group of *k* costs *k − 1* transfers, so the
minimum is `n − max(disjoint zero-sum subsets)` — found exactly with a bitmask
DP. The app **pays the engine per obligation over x402** for that computation.

A single restaurant bill has one creditor, so there is nothing to compress —
we say so in the product rather than pretend. The trip is where the engine
earns its keep.

## Security

- **Anyone with the link can read a group; only the server can write.**
  Row-level security compares the hash of a server-held token; the token is
  verified absent from the public bundle.
- **Nobody acts as someone else.** Each phone holds a secret whose hash lives
  in a table no browser can read. We tested it: a member cannot confirm as
  another, change another's amount, or change the split without being admin.
- **Money is whole cents, end to end.** Equal splits are tested to sum to the
  exact bill for every group size from 1 to 20.

## What is demo, stated plainly

- The people at the table settle through **testnet accounts the app holds**,
  so it can sign when each person taps "yes". A production version gives each
  person their own wallet and never sees the key.
- **No sign-in.** An earlier version put a Privy login in front of the sample
  trip; it stalled the demo and signed nothing on Hedera, so it was removed.
- The dollars are **tUSD, a test token we issued** (worth nothing, and its memo
  says so). The exchange rate is real. On mainnet the token would be USDC.
- Everything runs on **Hedera testnet**. The build cost nothing.

## Demo script

1. **The table** — create a $2,500 bill; show the QR; a second phone joins and
   the first screen updates on its own.
2. **The split** — switch between equal, custom and "each their own"; show it
   refusing to lock while the shares are short.
3. **The yes** — ask for confirmations; the "paid over x402" line appears —
   open it in HashScan. One person signs, still pending; the last signs, it
   executes. Open the schedule in HashScan.
4. **The trip** — the sample trip's plan: fifteen obligations settle into
   three transfers, and the receipt line shows the app just paid for that
   calculation, on chain.

## Stack

Next.js 16 · React 19 · TypeScript · Supabase (Postgres + Realtime, RLS) ·
`@hashgraph/sdk` · HTS (tUSD) · `@x402/hedera` · Motion · three.js · Vercel · Hedera testnet.
