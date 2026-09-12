# Architecture — Squash

Squash settles group debts in the fewest possible transfers and puts the whole
settlement on Hedera as one transaction that only goes through once everyone
has said yes. Bills in pesos are converted to US dollars at today's rate and
settle as tUSD, an HTS token. The app pays for its own settlement maths per
use, over x402.

Everything runs on **Hedera testnet**. Nothing here touches real money.

---

## The two flows

| | Split a bill at the table | The sample trip |
|---|---|---|
| Pages | `/nuevo` → `/g/[id]` | `/join` → `/plan` → `/sign` → `/done` |
| Who | Real people, joined by scanning a QR | Six demo friends, fixed expenses |
| State | Supabase (Postgres + Realtime) | In the browser |
| Plan | Bought from `/api/v1/net` over x402 | Bought from `/api/v1/net` over x402 |
| On chain | One scheduled transfer, executes on the last "yes" | Same |

Both flows buy their plan from the same metered engine, and both end with one
scheduled transaction.

---

## Split a bill at the table

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin's phone
    participant F as Friends' phones
    participant S as Next.js server
    participant DB as Supabase
    participant E as /api/v1/net (x402)
    participant B as Blocky402
    participant H as Hedera testnet

    A->>S: POST /api/groups (name, total)
    S->>DB: group + admin (pool slot 0)
    A-->>F: QR with /g/[id]
    F->>S: join
    S->>DB: member + pool slot
    DB-->>A: realtime: someone joined
    A->>S: split mode / amounts
    S->>DB: shares
    DB-->>F: realtime: your share
    A->>S: lock
    S->>S: today's MXN→USD rate, frozen; shares → US cents
    S->>E: POST obligations (no payment)
    E-->>S: 402 + PAYMENT-REQUIRED
    S->>E: retry + PAYMENT-SIGNATURE (agent account)
    E->>B: verify, settle
    B->>H: transfer agent → engine (Blocky402 pays the fee)
    E->>H: HCS proof of the run
    E-->>S: transfers + x402 receipt
    S->>H: ScheduleCreate — every tUSD transfer in one list
    S->>DB: status locked, schedule id, receipt
    F->>S: confirm (member secret)
    S->>H: ScheduleSign with that member's account
    Note over H: last signature → executes as one unit
    S->>DB: status settled
    DB-->>A: realtime: settled
```

**Split modes.** Equal (remainder cents are handed out one at a time, so the
shares always add back to the bill exactly), custom amounts set by the admin,
or "cada quien lo suyo" where each person types their own. A bill cannot be
locked until the shares add up to the total.

**Why the plan is bought, not computed locally.** The netting engine is the
product; the bill-splitting app is one of its customers. When the admin locks
the bill, the server pays the engine over x402 before anything is scheduled,
checks that the plan it got back adds up to the shares, and stores the payment
receipt on the group. The table shows that receipt with a HashScan link.

**Dollars, exactly.** A bill carries its currency. At lock time the server
fetches today's rate (open.er-api.com; frankfurter/ECB as fallback; an error
if both fail), freezes it on the bill with its date and source, and converts
every share to US cents with a largest-remainder rule, so the dollar shares
add up to the converted total and no share moves by more than a cent
(`src/lib/money.ts`, tested). What settles is **tUSD** (`0.0.10511085`), an
HTS fungible token with two decimals — one unit is one cent — created by
`scripts/create-dollar-token.mjs`. On mainnet the same code points at USDC.
Before scheduling, the treasury tops up any pool account that could come up
short, with an ordinary token transfer.

**Atomic settlement.** Every debit and credit goes into a single
`TransferTransaction` of tUSD wrapped in a `ScheduleCreateTransaction`. It sits pending
until every debited account has signed. The last signature executes it as a
unit. Nobody pays unless everybody pays — the network enforces it, not the app.
The bill is only marked settled when the scheduled transaction's own receipt
is `SUCCESS`; "executed" alone is not taken as "paid".

---

## Who holds which key — honestly

This is a hackathon build on testnet, and it is **custodial**:

- **Pool accounts** (`POOL_ACCOUNTS_JSON`): ten testnet accounts, one per seat
  at the table. Their keys live on the server. When a member presses "yes", the
  server checks their secret and signs the schedule with the account assigned
  to that seat.
- **Engine account** (`HEDERA_OPERATOR_*`): receives x402 payments, creates
  schedules, pays network fees, publishes HCS proofs.
- **Agent account** (`AGENT_*`): the customer that pays the engine over x402. It
  is deliberately a different account; the facilitator refuses a payment to
  yourself.
- **Privy** is used for sign-in on the sample trip only. It does **not** sign
  Hedera transactions — a Privy wallet is an Ethereum wallet and cannot.

What changes for production is only who signs the `ScheduleSign` step: each
person would sign `ScheduleSign` from their own Hedera wallet (HashPack or
WalletConnect). The schedule, the netting and the x402 payment stay the same.

---

## Security of the shared state

- **Anyone can read, only the server can write.** Row-level security allows
  reads with the public anon key. Writes pass only when the request carries an
  `x-squash-token` header whose SHA-256 matches a hash stored in the database
  function `squash_is_server()`.
- `SQUASH_WRITE_TOKEN` has no `NEXT_PUBLIC_` prefix, so it is never bundled for
  the browser; `serverClient()` throws if it is ever called client-side.
- **Member secrets.** Joining returns a random secret kept in the phone's
  `localStorage`. Only its hash is stored, in `member_secrets`, a table
  browsers cannot read. Every action is checked with a timing-safe comparison.
- **Rules live on the server** (`src/lib/groups.ts`): only the admin changes
  the split; nobody joins or edits once confirmations start; nobody confirms
  for someone else; amounts are whole cents.

`scripts/test-dinner.mjs` runs the whole dinner against any deployment,
including those attacks, and fails if any of them gets through.

---

## The netting engine

`src/lib/netting.ts`. All money is integer cents.

1. Expenses expand into obligations ("Diego owes Rosa $833.34").
2. Obligations collapse into one net balance per person.
3. The minimum number of transfers is `n − k`, where `k` is the largest number
   of disjoint groups whose balances sum to zero. A bitmask dynamic programme
   finds `k` exactly for up to 15 people with a non-zero balance; above that it
   falls back to a greedy match and says so (`optimal: false`).

The sample trip compresses 15 debts into 3 transfers.

---

## x402 on Hedera

`/api/v1/net` is priced per obligation (0.0004 ℏ each up to 10, cheaper in
volume — `src/lib/pricing.ts`).

- Unpaid call → `402` with the requirements in the `PAYMENT-REQUIRED` header
  (x402 v2, Hedera `exact` scheme).
- The caller (`src/lib/payingClient.ts`, built on the official `@x402/fetch`
  and `@x402/hedera` clients) signs a partial transfer and retries with
  `PAYMENT-SIGNATURE`.
- The engine sends it to **Blocky402** `/verify` and `/settle`. Blocky402
  co-signs as fee payer and submits, so the paying account needs no HBAR for gas.
- Only after settlement does the engine run, publish a proof of the run to HCS
  topic `0.0.10452145`, and answer with the plan and the receipt.

If the facilitator is unreachable the engine answers `502` instead of doing the
work for free.

---

## Code map

```
src/lib/netting.ts          the solver
src/lib/split.ts            equal / custom / own shares, to the cent
src/lib/money.ts            currencies and the one MXN→USD conversion
src/lib/fx.ts               today's rate, two keyless sources
src/lib/groups.ts           every rule of a bill, server-side
src/lib/payingClient.ts     the app paying the engine over x402
src/lib/x402.ts             the engine's side of x402 (Blocky402)
src/lib/scheduled.ts        ScheduleCreate / ScheduleSign / status
src/lib/hcs.ts              proof of each run on HCS
src/lib/supabase.ts         read client (browser) and write client (server)
src/app/api/v1/net          the metered engine
src/app/api/groups          create / join / split / lock / confirm
src/app/api/plan, settle    the sample trip
src/app/g/[id]              the table, live
```
