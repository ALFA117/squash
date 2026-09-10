# Start here

## Running it, in one minute

```bash
git clone https://github.com/ALFA117/squash
cd squash
npm install
npm test        # 15 tests, no network, no credentials
npm run dev
```

Open <http://localhost:3000>. **No configuration is needed.** With no
`.env.local` at all the engine answers for free, the plan still computes, and
every screen works — verified from a clean checkout. Credentials are only for
exercising the paid path.

The flow is `/join` → `/` → `/expense` → `/plan` → `/sign` → `/done`.

## Getting your own testnet accounts

Do not use anyone else's keys. Yours take about five minutes and cost nothing.

1. <https://portal.hedera.com/> → Testnet → create an account. It hands you an
   Account ID and a private key, and tops you up 1,000 test HBAR every 24 h.
2. `cp .env.local.example .env.local` and fill in `HEDERA_OPERATOR_ID`,
   `HEDERA_KEY_TYPE` and `HEDERA_OPERATOR_KEY`.
3. `node scripts/create-topic.mjs` → paste the topic id back into the file.
4. `node scripts/create-agent.mjs` → paste the three `AGENT_*` values back.
5. Set `X402_ENABLED=true`, restart, then `node scripts/agent.mjs`.

That last command is the whole thesis in one screen: an agent asks for work,
gets a 402, pays, and gets its answer.

## The map

```
src/lib/netting.ts        the solver — the product is in this file
src/lib/netting.test.ts   15 tests, including the cases where greedy is wrong
src/lib/pricing.ts        per-obligation quote, in tinybars
src/lib/x402.ts           the 402 challenge and the facilitator calls
src/lib/payingClient.ts   the app buying a run from the engine
src/lib/hcs.ts            proof of each run, published to consensus
src/lib/scheduled.ts      all-or-nothing settlement — NOT WIRED UP YET
src/lib/sample.ts         the demo group and its expenses

src/app/api/v1/net/       THE ENGINE. Metered, strict, no bypass.
src/app/api/plan/         THE APP, as a paying customer of the engine.
src/app/*/page.tsx        the six screens
src/components/           the debt graph and the paying notice

scripts/agent.mjs         an agent that discovers, pays, and is answered
scripts/create-topic.mjs  one-time HCS setup
scripts/create-agent.mjs  funds a second account so the payer ≠ the payee
```

The engine and the app are separate concerns that happen to deploy together.
Keep them that way: the app talks to the engine over HTTP and pays for what it
gets. That separation is what makes the live site a real demonstration instead
of a mock.

## What is open, and where to start

Read [STATUS.md](STATUS.md) first — it is the honest ledger.

### 1. Scheduled settlement — the one that matters

`src/lib/scheduled.ts` is **dead code**. Nothing imports it. `/sign` holds a
`useState`, waits 450 ms and navigates to `/done`.

This is the only place where the pitch claims something the code does not do.
"Nobody pays until everybody confirms, it is a property of the transaction" is
today a property of a `setTimeout`.

The module already exposes what is needed:

```ts
scheduleSettlement(transfers, accounts, rate) → { scheduleId, awaiting }
signSchedule(scheduleId, signerKey)           → void
scheduleStatus(scheduleId)                    → { executed, executedAt, … }
```

What is missing is a route that calls them, a way to map the six people to six
testnet accounts (`scripts/create-agent.mjs` mints them), and a `/sign` screen
that polls `scheduleStatus` instead of pretending. When the last signature
lands, `/done` gets a real receipt and its explorer link appears on its own —
that branch already exists.

### 2. Privy — $2,500

Not started. Needs an App ID from dashboard.privy.io (free; the App **ID** is
public, the App **Secret** is not and is not needed for the client). The track
wants one functional financial flow with a Privy wallet — this app is that
flow. Replace the notion of "people" in `src/lib/sample.ts` with Privy-backed
users and let them sign.

### 3. World Selfie Check — $3,500, three winners

Not started. Needs an App ID **and** the sandbox access form, which is an
external approval on the critical path — send it before doing anything else,
or skip the track. `/join` is already written as the place it goes, framed
around what it defends: someone who can invent counterparties can inject
phantom debts into the graph. One person, one node.

## House rules

**Money is integer cents. Never floats.** `formatCents` is for display only.
The split remainder is handed out one cent at a time so shares always sum back
to the exact total — there is a test for it.

**Never invent a hash.** `/done` shows an explorer link only when the engine
returned a real receipt, and says "demo run" otherwise. A dead link to a real
explorer is worse than no link.

**The engine has no bypass.** When payment cannot complete, the app computes
the plan in-process and marks it unpaid. It does not ask the engine to work for
free. A bypass an unpaid caller can reach is not a gate.

**Build x402 payloads with `@x402/hedera`, never by hand.** The facilitator
validates strictly and rejects a hand-rolled transaction with a bare 500 and no
diagnostic. Two other things that cost a day and are not guessable: the v2
challenge travels in the `PAYMENT-REQUIRED` header (only v1 reads the body),
and `PaymentRequired` needs a top-level `resource`. The 402 body is validated
against the SDK's own schema so it cannot drift again.

**Say what a wait is for.** The plan takes ~10 s cold because the app is
really buying it. The loading state names that instead of spinning.
