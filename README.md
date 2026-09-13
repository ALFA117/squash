# Squash

**`git squash`, but for money.**

A multilateral netting engine. Give it N obligations between N parties and it
returns the settlement plan with the **provably minimum** number of transfers —
then settles them atomically, so nobody pays until everybody has signed.

The expense-splitting app in this repo is the demo. The engine is the product,
and it is metered: any app or agent can call it and **pay per obligation** over
x402 on Hedera. No API key, no subscription, no seat.

```
15 obligations between 6 people  →  3 transfers  ·  80% fewer, 80% less in fees
```

**Live:** <https://squash-pay.vercel.app> — `/nuevo` splits a bill at a table, `/join` walks the sample trip.

**Try it in a minute:** open `/nuevo`, create a bill in pesos or dollars, open the QR on a second device (or a private window), and confirm from both. The pesos are converted at today's rate and settle as tUSD, a Hedera dollar token.

**Picking this up?** [CONTRIBUTING.md](CONTRIBUTING.md) gets you running in a
minute with no credentials. [STATUS.md](STATUS.md) is the honest ledger of what
works, what is written but never executed, and what has not been started.

---

## Status

| Piece | State |
|---|---|
| **Split a bill at the table** — real QR, live, three split modes, everyone confirms | **done**, 27/27 against production |
| The bill buys its settlement plan from the engine over x402 before scheduling | **done — paid on testnet, receipt shown at the table** |
| Pesos → dollars at today's rate, settled as tUSD (HTS, 1 unit = 1 cent) | **done** — [a $1,500 MXN split, US$88.40 moved](https://hashscan.io/testnet/transaction/0.0.10450391-1789253509-329841529) |
| Netting engine + exact minimum solver | **done** |
| `POST /api/v1/net`, priced per obligation | **done**, live |
| x402 gate, Hedera `exact` scheme | **done** |
| Agent completing a real paid request | **done — settled on testnet** |
| HCS proof-of-run audit trail | **done — published on testnet** |
| Scheduled Transaction atomic settlement | **done — executes on the last signature** |
| Tests | **47** — solver, split rules, currency conversion, input validation |
| Privy | removed — it stalled the demo and signed nothing on Hedera |
| World Selfie Check | not attempted |

---

## Proof

Not a claim — go and look. One netting run, paid for and published:

**The payment** — [`0.0.7162784@1789008230.889484170`](https://hashscan.io/testnet/transaction/0.0.7162784-1789008230-889484170)

```
result  SUCCESS   CRYPTOTRANSFER
  0.0.10452163   -525,000 tinybars   the agent, paying for the work
  0.0.10450391   +525,000 tinybars   the engine, getting paid
  0.0.7162784    -261,818 tinybars   the facilitator, paying the network fee
```

That last line is the point. The agent spent **0.00525 ℏ** on the work and
**nothing** on gas — the facilitator sponsored the fee. A caller can pay for a
service without holding the network's token.

**The proof of the run** — topic [`0.0.10452145`](https://hashscan.io/testnet/topic/0.0.10452145), message 1:

```json
{"v":1,"inputHash":"49eba72dc6cbd954d59d92b4d8da17d7c6b9f4d2f5d5d4a7cd56a1d13527c114",
 "obligations":15,"transfers":3,"compression":0.8,"optimal":true,
 "plan":["tu>rosa:204000","diego>mariana:111000","luis>ana:57000"]}
```

Hash the same obligations yourself, find the message, and check that the plan
we published is the plan we ran. The compression is auditable, not asserted.

## The engine

`src/lib/netting.ts`. Everything is integer cents; no floats touch money.

1. **Expand** — each shared expense becomes obligations. Cents that do not
   divide evenly are handed out one at a time, so shares always sum back to the
   exact total.
2. **Net per pair** — two people who owe each other only really owe the
   difference. What remains is the honest "before" count.
3. **Net globally** — each party's single net position. Sums to zero, always.
4. **Solve** — the settlement plan.

### Why the plan is minimal, not just small

Every settlement plan decomposes into groups that each sum to zero, and a group
of size *k* costs *k−1* transfers. So minimising transfers means **maximising
the number of disjoint zero-sum groups**:

```
minimum transfers = n − max(disjoint zero-sum subsets)
```

We find that maximum exactly with a bitmask DP over subsets (each candidate
group is forced to contain the lowest remaining party, so no partition is
counted twice). Above 15 non-zero balances the exact search is too slow and the
engine falls back to greedy — the response says which, in `optimal`.

Greedy alone would settle the sample trip in 3 transfers too, but it is not
guaranteed to: on `{a:−100, b:+100, c:−250, d:+250}` greedy chains three
transfers where two suffice. There is a test for exactly that.

---

## The API

```
POST /api/v1/net
{ "expenses":    [{ "id", "label", "payer", "cents", "among": [...] }] }
{ "obligations": [{ "from", "to", "cents" }] }
```

Returns the balances, the pairwise edges, the transfer plan, whether the plan
is proven optimal, the compression ratio, and the price.

**Pricing is per obligation, not per request** (`src/lib/pricing.ts`) — a caller
who brings a bigger graph pays for the bigger graph:

| Obligations | Price each |
|---|---|
| 1–10 | 0.00040 ℏ |
| 11–50 | 0.00035 ℏ |
| 51–200 | 0.00028 ℏ |
| 201+ | 0.00021 ℏ |

With `X402_ENABLED=true` an unpaid call is answered with `402` and the payment
requirements — carried in the `PAYMENT-REQUIRED` header, which is where the v2
protocol puts them; only v1 clients read the body. The caller retries with
`PAYMENT-SIGNATURE`, which is verified and settled through the Blocky402
facilitator before any work is done.

Build the payment with the official `@x402/hedera` client, not by hand. The
facilitator validates the serialized transaction strictly and rejects a
hand-rolled one with a bare 500 and no diagnostic.

---

## Running it

```bash
npm install
npm test        # 47 tests, no network, no credentials
npm run dev
```

The sample trip needs no configuration — with no `.env.local` the engine
answers for free and those screens work. **Splitting a bill at a table needs
Supabase** (shared state across phones) and a pool of testnet accounts; without
them `/nuevo` says so rather than failing silently. Credentials are for that and
for the paid path, and
[CONTRIBUTING.md](CONTRIBUTING.md) walks through getting your own in about five
minutes. Everything runs on Hedera **testnet**, which is what the prize rules
allow and what keeps the build cost at zero.

---

## Layout

```
src/lib/netting.ts        the solver — the whole product is in here
src/lib/netting.test.ts   15 tests, including the minimality proof cases
src/lib/split.ts          the money rules for one bill — 15 tests
src/lib/groups.ts         the rules of a table, enforced server-side
src/app/nuevo/            start a bill
src/app/g/[id]/           the table: join, split, confirm — what the QR opens
src/lib/pricing.ts        metered per-obligation quote
src/lib/sample.ts         the demo group
src/app/api/v1/net/       the metered endpoint
src/app/page.tsx          the landing
src/lib/x402.ts           the 402 challenge and the facilitator calls
src/lib/hcs.ts            proof-of-run published to the consensus service
src/lib/scheduled.ts      the plan as one all-or-nothing scheduled transfer
src/app/plan/page.tsx     the settlement plan — calls the engine over HTTP
src/components/DebtGraph  the before/after picture, laid out from the data
scripts/agent.mjs         the paying agent
scripts/create-topic.mjs  one-time HCS topic setup
scripts/create-agent.mjs  funds a second account so the agent is not the payee
scripts/create-pool.mjs   funds the accounts a table's members settle through
scripts/test-dinner.mjs   a whole dinner plus five attacks, against any server
```

The plan screen calls the API over HTTP rather than importing the engine, so the
paid path gets exercised end to end the moment the 402 challenge is switched on.

## License

MIT
