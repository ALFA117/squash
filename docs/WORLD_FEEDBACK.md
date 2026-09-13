# World ID · Selfie Check — integration feedback

*Squash, ETHOnline 2026. Written while integrating Selfie Check into a live
bill-splitting app, on 12–13 September 2026.*

## What we built, and why Selfie Check fits it

Squash splits a restaurant bill: whoever paid shows a QR, everyone scans it,
takes a **seat**, sees their share and confirms; one Hedera transaction settles
it on the last "yes". Anyone with the link can take a seat — which is exactly
where a low-assurance, low-friction liveness credential earns its place:

| Signal | Where | What Selfie Check prevents |
|---|---|---|
| **Fairness / abuse prevention** | "Verified people only" switch (admin) | Fake guests padding an equal split; one person holding two seats. The action is scoped to the bill (`squash-seat-<billId>`), so the same person gets the same nullifier at the same table and a different one anywhere else — duplicates are refused, nobody is trackable across bills. |
| **Eligibility** | Locking the bill | With the switch on, confirmations cannot start until every seat is verified. |
| **Continuity** | "Get my seat back with World ID" | A seat lives in one browser. Lost phone or cleared cache: pass Selfie Check again → same nullifier → same seat, without asking the admin. |

Design choices: the nullifier is stored server-side next to the seat's secret,
in a table no browser can read (Supabase RLS); other people only see a
"verified" badge. The RP request is signed on our server
(`/api/world/context`), the proof is verified server-side against
`POST https://developer.world.org/api/v4/verify/{rp_id}` before anything is
granted, and the widget never decides anything on its own.

Code: `src/lib/world.ts` (signing, verification, nullifier), `src/lib/groups.ts`
(`joinGroup` with proof, `verifySeat`, `recoverSeat`, `setRequireHuman`),
`src/components/WorldButton.tsx` (`IDKitRequestWidget` + `selfieCheckLegacy`),
`src/app/api/world/context/route.ts`.

Packages: `@worldcoin/idkit@4.2.3`, `@worldcoin/idkit-server@1.1.1`.

---

## 1. Selfie Check docs and integration flow

**What worked well**
- `selfieCheckLegacy({ signal })` as a preset is the right abstraction: one
  line to ask for this credential instead of hand-building constraints.
- `@worldcoin/idkit-server`'s `signRequest` is pure JS, no WASM — it just
  worked in a Next.js route handler. The d.ts comments (message layout,
  EIP-191) are better than the web docs.
- `https://docs.world.org/llms.txt` was the fastest way to find the right
  pages. More docs should have one.

**What was confusing**
- **Three different ways to get access** depending on the page: the testing
  page says "request access through your World point of contact", the
  credentials page says email developers@toolsforhumanity.com, and the
  ETHGlobal prize page links a Google Form. One canonical path, linked from
  all three, would save a day.
- **`rp_context` mapping is not shown.** `signRequest` returns camelCase
  `{ sig, nonce, createdAt, expiresAt }` and no `rp_id`; the widget wants
  snake_case `{ rp_id, nonce, created_at, expires_at, signature }`. We found
  the target shape only in `idkit-core/dist/index.d.ts`. A three-line
  "server → client" snippet in the React page would fix it.
- **`allow_legacy_proofs`**: the credentials page says it "is not required for
  Selfie Check", but the TypeScript config types it as a **required** boolean.
  Either the type or the sentence is wrong; we pass `true`.
- **The result shape handed to `handleVerify` is undocumented** in the React
  reference. The verify endpoint lists 3.0 and 4.0 formats, but neither page
  says which one a Selfie Check proof comes back as.

## 2. Developer Portal: navigation, search, discovery, debugging

- The docs explain *that* an RP ID and a signing key exist, but not *where*
  in the Portal to find them or whether an **action must be pre-registered**
  for 4.0 uniqueness proofs (in 3.0 it had to be). We scope actions per bill
  (created on the fly); if that needs registration, it should say so loudly.
- Product discovery: from the Portal it is not obvious that Selfie Check is a
  separate, gated product rather than a verification level of World ID.
- Debugging: the verify endpoint's `code`/`detail` pair is good. We surface it
  to the user verbatim; a public table of `code` values would help.

## 3. Sandbox: app states, proof flows, test users, errors, edge cases

- **There is no simulator** for the sandbox — only a sandbox World ID app on a
  physical phone via TestFlight / Play testing, each behind an approval. That
  rules out CI and makes the first test depend on two external approvals
  (sandbox app + Selfie Check feature flag) during a 36-hour event.
- **`environment` values disagree across pages**: the React example uses
  `"production"`, the JS reference mentions `"staging"` for the simulator, the
  sandbox page says `environment: sandbox`, and the types accept all three.
  For Selfie Check in sandbox we default to `"sandbox"` via
  `NEXT_PUBLIC_WORLD_ENV`.
- Resettable test accounts are great — please say whether a reset produces a
  **new nullifier** for the same action. Our continuity feature depends on
  nullifier stability; we would like to test both cases deliberately.
- Edge cases we handle explicitly: the same person trying to take a second
  seat (nullifier already bound → 409, "use Get my seat back"); a proof for
  another bill (action mismatch → refused); an expired request (we fetch a
  fresh signed context on every tap, TTL 300 s); `user_rejected` and other
  widget errors shown to the user.

## 4. What was confusing, missing, broken, or hard to test

1. **Access is the critical path.** Everything up to a real proof can be built
   from the docs; the proof itself waits on approvals with unknown latency.
   A clearly-labelled "hackathon fast lane" would change that.
2. **No offline or simulated proof** means we could not write an automated
   test for the verify path; our end-to-end suite covers everything around it.
3. **Docs vs types drift** (`allow_legacy_proofs`, `environment`, the
   `rp_context` shape). The shipped `.d.ts` files were the source of truth.
4. Missing: a complete, copy-pasteable Next.js App Router example —
   route handler that signs, widget, route handler that verifies — using
   Selfie Check specifically.

## Status at submission

- Integration complete and deployed, off by default: it turns on when
  `NEXT_PUBLIC_WORLD_APP_ID`, `WORLD_RP_ID` and `WORLD_RP_SIGNING_KEY` are set.
- RP request signing verified locally (65-byte signature, 32-byte nonce, TTL).
- A live Selfie Check proof depends on sandbox access, requested through the
  form linked from the prize page.
