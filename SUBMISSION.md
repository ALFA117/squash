# Submission — Squash: Multilateral Netting on Hedera

## The Problem
Groups often struggle to settle debts efficiently. Existing solutions require manual tracking, trust in a central party, or expensive gas fees that make small-amount settlements impractical. 

## The Solution
Squash is a multilateral netting engine built on Hedera that minimizes the number of transactions required to settle all debts in a group. By leveraging Hedera’s **Scheduled Transactions**, Squash enables atomic settlement: all debits and credits are combined into a single, pending transaction that executes as a single unit only when all parties have confirmed.

## Why Hedera & Privy?
- **Hedera:** We use **Scheduled Transactions** to guarantee atomicity. "Nobody pays until everyone signs" is not just a promise; it is a hard technical property of the transaction.
- **Privy:** We replaced demo accounts with **Privy Embedded Wallets**. This allows real users to authenticate with their own credentials and sign transactions directly from their devices, without the application ever holding their private keys.
- **Sustainability:** The settlement leg is optimized to cost nearly zero to the user, as the application facilitates the submission.

## Features
- **Optimal Netting:** A proven solver minimizes the total number of transactions.
- **Atomic Settlement:** All transfers execute simultaneously or not at all.
- **Secure Authentication:** Privy-backed wallets for self-custodial signing.
- **Metered Access:** x402-gated netting engine ensures fair resource usage.

## Tech Stack
- **Frontend:** Next.js, React, Vanilla CSS.
- **Smart Contracts/Protocol:** Hedera Hashgraph SDK.
- **Authentication/Wallet:** Privy.
- **Architecture:** Serverless API on Vercel for netting coordination.
