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

---

## Status

| Piece | State |
|---|---|
| Netting engine + exact minimum solver | **done**, 15 tests green |
| `POST /api/v1/net` with metered quote | **done**, answers free while the rail is built |
| Group + settlement plan UI | **done** |
| x402 payment via Blocky402 facilitator | next |
| HCS proof-of-run audit trail | next |
| Scheduled Transaction atomic settlement | next |
| Privy embedded wallets | next |
| World Selfie Check on group join | next |

---

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

Today the route answers for free and returns the quote it *would* charge, so the
UI could be built against it. Turning on `X402_ENABLED` moves that same quote
into a `402 Payment Required` challenge and verifies the `X-PAYMENT` header
through the Blocky402 facilitator before any work runs.

---

## Running it

```bash
npm install
npm test        # 15 tests, no network needed
npm run dev
```

Then open `/` for the group and `/plan` for the settlement.

### Configuration

Copy `.env.local.example` to `.env.local` and fill it in. **`.env.local` is
gitignored — never commit it, and never use a key from a wallet holding real
funds.** Create a fresh testnet account instead:

- <https://portal.hedera.com/> gives 1,000 test HBAR every 24 h
- the anonymous faucet gives 100 every 24 h, no account at all

Neither asks for a card or personal data. Everything in this project runs on
Hedera **testnet**, which is what the prize rules allow and what keeps the build
cost at zero.

---

## Layout

```
src/lib/netting.ts        the solver — the whole product is in here
src/lib/netting.test.ts   15 tests, including the minimality proof cases
src/lib/pricing.ts        metered per-obligation quote
src/lib/sample.ts         the demo group
src/app/api/v1/net/       the metered endpoint
src/app/page.tsx          group ledger
src/app/plan/page.tsx     the settlement plan — calls the engine over HTTP
src/components/DebtGraph  the before/after picture, laid out from the data
```

The plan screen calls the API over HTTP rather than importing the engine, so the
paid path gets exercised end to end the moment the 402 challenge is switched on.

## License

MIT
