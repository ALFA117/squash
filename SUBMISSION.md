# Squash — git squash, but for money

**Live:** <https://squash-pay.vercel.app> · **Code:** <https://github.com/ALFA117/squash>

## Elevator pitch

A group that shares expenses ends up owing everyone everything. Squash
compresses that tangle to the **provable minimum** number of transfers, then
settles the whole plan as **one Hedera scheduled transaction** that cannot
execute until every payer has signed.

```
15 obligations between 6 people  →  3 transfers  ·  80% fewer
```

## Don't take our word for it

Every claim below links to the chain.

| Claim | Proof |
|---|---|
| An agent paid for a netting run over x402, and **spent nothing on gas** — the facilitator paid the fee | [tx `0.0.7162784@1789008230.889484170`](https://hashscan.io/testnet/transaction/0.0.7162784-1789008230-889484170) |
| Each run's inputs and plan are published, so anyone can recompute it | [HCS topic `0.0.10452145`](https://hashscan.io/testnet/topic/0.0.10452145) |
| A settlement that stayed pending through two signatures and executed on the third | [schedule `0.0.10509320`](https://hashscan.io/testnet/schedule/0.0.10509320) |

## How it works

1. **The group records expenses** — who paid, split among whom. Cents that do
   not divide evenly are handed out one at a time, so shares always sum to the
   exact total.
2. **The engine computes the plan.** Every settlement plan decomposes into
   groups that sum to zero, and a group of *k* costs *k − 1* transfers — so the
   minimum is `n − max(disjoint zero-sum subsets)`, found exactly with a bitmask
   DP. Above 15 balances it falls back to greedy and says so.
3. **The app pays the engine for that computation**, over x402 on Hedera,
   priced per obligation rather than per request. The browser never touches a
   key; the app's server is the paying customer.
4. **The plan becomes one scheduled transaction.** Every debit and every credit
   in a single transfer list, pending until each debited account signs.
5. **The last signature executes it** as a unit. Nobody pays until everybody
   has — not because the app waits, but because the transaction cannot go
   through incomplete.

## Why Hedera

The product's promise is *nobody pays until everyone confirms*. On most
chains that is a promise the app keeps. On Hedera it is a property of the
transaction: a scheduled transaction simply cannot execute until its required
signatures are present. That is the reason this is built here.

The x402 facilitator also **sponsors the network fee**, so whoever pays for the
computation does not need to hold HBAR at all.

## Why the result is the minimum, not just small

The usual greedy method — largest debtor pays largest creditor, repeat — also
settles the sample trip in 3, but is not guaranteed to. On
`{a: −100, b: +100, c: −250, d: +250}` it chains three transfers where two
suffice. There is a test for exactly that case.

## What is demo, stated plainly

The six people in the sample group are throwaway **testnet accounts whose keys
the app holds**, so it can sign on their behalf when they confirm. A production
version gives each person their own wallet and never sees the key.

**Privy is used for sign-in** — identity without a password or seed phrase.
Signing Hedera transactions *with* a Privy wallet is not done here: a Privy
wallet is an Ethereum key that does not control a Hedera account, and would
need each account created from the wallet's public key. That is the next step,
not a claim.

Everything runs on **Hedera testnet**. The build cost nothing.

## Demo script

1. **Landing** — the problem: a group's debts become a tangle.
2. **The plan** — watch fifteen faint obligations settle, then three transfers
   draw themselves through them. Point at the receipt line: the app just paid
   for that calculation, on chain.
3. **Signatures** — Diego signs, the schedule stays pending. Luis signs, still
   pending. You sign, and it executes.
4. **Done** — open the receipt in HashScan. It is a real scheduled transaction.

## Stack

Next.js 16 · React 19 · TypeScript · `@hashgraph/sdk` · `@x402/hedera` ·
Privy (sign-in) · Vercel. Hedera testnet.
