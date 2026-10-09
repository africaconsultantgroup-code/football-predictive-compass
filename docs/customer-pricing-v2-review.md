# Customer Pricing V2 — implementation review

Historical checkpoint: its original price policy is superseded by [the GH₵8 replacement review](customer-pricing-v2-ghs8-replacement.md). Amounts and test totals below describe the earlier checkpoint, not the active V2 policy.

Implemented locally in the customer repository. Production was not accessed or changed. No commit, push, production migration or deployment was performed. HEAD remains `7a135c7f123f69049a58dc9bd25eb2ecf58c3212`.

## 1. Files changed

Pricing and payment services:

- `lib/payments/match-pricing.ts` — central integer-pesewa policy, validation, Ghana dates and quote revalidation.
- `lib/payments/pricing-version.ts` — explicit migration-first activation switch.
- `lib/payments/basket-service.ts` — stored quotes, one provider reference per basket, verification and atomic fulfillment.
- `lib/payments/service.ts` — basket verification dispatch and combined customer payment history; legacy callbacks remain supported.
- `app/api/payments/matches/quote/route.ts` — authenticated, strict, server-authoritative quote endpoint.
- `app/api/payments/paystack/initialize/route.ts` — V2 accepts only the quote ID; old stage checkout is rejected when V2 is active.
- `app/payments/paystack/callback/page.tsx` — safe reconciliation wording.

Customer presentation:

- `app/matches/match-basket.tsx`, `app/matches/match-basket.css` — selection, removal, same-day guidance, server quote breakdown and one checkout.
- `app/matches/dashboard.tsx`, `app/matches/match-components.tsx` — cross-competition selection, competition labels and Premium Unlocked state; V2 removes pass/full-match preview offers.
- `app/matches/free-detail.tsx`, `app/matches/[matchId]/page.tsx` — single-match purchase uses the same basket flow.
- `app/predictions.tsx` — V2 single-match checkout and removal of legacy kickoff-slot selling.
- `app/layout.tsx` — basket stylesheet.
- `app/how-it-works/page.tsx`, `app/experience-components.tsx`, `app/live-matches.tsx` — matching pricing/access copy.
- `app/account/page.tsx` — pending basket payments can be verified through the existing callback flow.

Entitlements, historical access and operations:

- `lib/auth/match-access.ts` — permanent ownership authorizes every commercial stage; retains existing grants and capability overrides.
- `lib/predictive-compass/premium-purchase.ts` — recognizes purchased V2 matches.
- `lib/predictive-compass/server.ts` — V2 reads stop synchronizing legacy stage-priced products; forecast request/parsing behavior is retained.
- `lib/reports/post-match.ts` — permanent purchases appear in customer history; free settlement facts remain available, while restricted historical snapshots require ownership or existing authorized stage/capability access.
- `app/admin/baskets/page.tsx`, `app/admin/admin-shell.tsx` — separate, admin-authorized, read-only basket ledger and permanent grant counts.

Database, tests and validation helpers:

- `supabase/migrations/20261008150122_customer_match_pricing_v2.sql`
- `supabase/tests/customer_match_pricing_v2.sql`
- `lib/payments/match-pricing.test.ts`
- `lib/payments/basket-service.test.ts`
- `lib/payments/pricing-v2-read-boundary.test.ts`
- `lib/auth/match-ownership-v2.test.ts`
- `lib/reports/post-match-v2.test.ts`
- `app/api/payments/matches/quote/route.test.ts`
- `app/api/payments/paystack/initialize/route-v2.test.ts`
- `app/matches/pricing-v2.test.tsx`
- `scripts/pricing-v2-staging.mjs`, `scripts/pricing-v2-db-regression.mjs`, `scripts/pricing-v2-runtime-check.mjs`
- This report.

Pre-existing staging edits to `.gitignore`, `app/globals.css`, `eslint.config.mjs`, `lib/payments/payments.test.ts`, `lib/payments/paystack.ts`, `next.config.ts`, `package.json` and `tsconfig.json` were preserved. They are not new Pricing V2 changes. Existing untracked reports/staging resources were also preserved.

## 2. Pricing examples

| Matches | Per match, GHS | Total, GHS | Paystack pesewas | Discount, GHS |
|---:|---:|---:|---:|---:|
| 1 | 20 | 20 | 2,000 | 0 |
| 2 | 18 | 36 | 3,600 | 4 |
| 3 | 18 | 54 | 5,400 | 6 |
| 4 | 16 | 64 | 6,400 | 16 |
| 5 | 16 | 80 | 8,000 | 20 |
| 6 | 15 | 90 | 9,000 | 30 |
| 8 | 15 | 120 | 12,000 | 40 |
| 10 | 15 | 150 | 15,000 | 50 |

The server applies the tier to the entire new basket. Already-owned IDs are rejected rather than silently repricing the selection. Duplicate/invalid IDs and mixed Ghana calendar dates are rejected. Competitions do not affect the discount. The API bounds requests at 100 selected matches; it does not introduce another pricing tier. Totals are tested as strictly increasing through that bound.

## 3. Database changes

The additive migration was applied only by direct SQL to `supabase_db_predictive-compass-customer-staging`. It has not been applied or recorded in production migration history.

New tables:

- `match_basket_quotes`: immutable exact fixture IDs/identities/kickoffs, Ghana date, policy, tier, amount and ten-minute expiry.
- `match_basket_payments`: one transaction/reference per accepted quote, provider checkout URL and payment state.
- `customer_match_entitlements`: unique permanent ownership per customer/match, with legacy or basket payment provenance.
- `match_checkout_reservations`: prevents overlapping pending checkouts for the same customer/match.

All four tables use RLS. Customers can read only their own quotes, payments and ownership; they have no commerce write privileges. Reservations are server-only. New RPCs are `SECURITY INVOKER`, use an empty search path, and are executable only by the service role. Per-customer advisory transaction locks serialize acceptance and fulfillment. Grants and successful state commit atomically.

The migration adds permanent ownership for successful historical payments, independent of old product activity or grant expiry. It leaves legacy payment amounts, products, grants and expiry values intact. A trigger also bridges successful legacy callbacks that arrive later. Pending legacy payments block overlapping V2 purchases. Unpaid/failed payments are not converted to ownership, and unpaid/manual legacy grants keep their existing stage rules.

Database tests run in rollback transactions. Concurrent tests use and remove only their own unique temporary schema inside the fixed staging container. The four actual new staging tables still contain zero rows after validation.

## 4. Paystack integration

Existing provider initialization, signature verification, provider transaction verification and callback routing are reused. No genuine Paystack transaction was initialized or charged.

The browser submits match IDs to obtain a quote, then submits only `quote_id` to initialize checkout. It cannot supply amount, currency, customer ID, tier or provider metadata. One transaction is initialized for the entire basket. Verification checks the stored reference, exact pesewas, GHS and bound payment/customer/quote/policy metadata before fulfillment.

Replay is idempotent. Overlapping reservations and existing ownership block repeat purchase. Verified failed/abandoned/reversed payments grant nothing and release reservations. Ambiguous initialization timeouts keep the original reference/reservation rather than risking a second charge. The account exposes verification of pending references.

Changed fixture identities/kickoffs, changed selection/pricing and expired unaccepted quotes require a new quote and explicit checkout action. If a fixture changes while checkout is already open, a subsequently verified payment is held as `grant_failed` for reconciliation, without silently changing the paid basket or automatically charging again. Automatic refunds or resolution of these held cases are not implemented; operations must review them.

## 5. Customer UI

V2 defaults the match view to all supported competitions. Available upcoming Premium match rows show competition, teams, Ghana kickoff, independent Free forecast availability, standard GH₵20 price and a selection checkbox. Owned matches show Premium Unlocked with no selection checkbox. The basket retains selected IDs when filtering and supports removing/clearing selections. Mixed Ghana days are blocked locally and authoritatively on the server.

Authenticated customers see the returned server quote: count, regular price, discount, price per match, total and expiry. The checkout button uses that quote, for example `Unlock 4 Matches — GH₵64`. No separate stage, pass or subscription checkout is introduced. Single-match detail/home checkout uses the same quote service.

The local production-mode page was checked in the browser: the basket/empty state rendered correctly and no old pass/full-match preview appeared. The actual isolated staging feeds contain zero stored upcoming Premium and Free snapshots, so a populated genuine-data browser purchase could not be verified. Test fixtures are confined to automated contract/commerce tests; no forecast fixture or probability was inserted into staging.

Screenshot: `output/pricing-v2/staging-basket-desktop.png`.

## 6. Entitlement verification

- One successful basket grants each selected match once and permanently.
- Ownership unlocks prematch, live and halftime authorization, with no expiry-based repurchase.
- Successful historical purchases remain owned even with expired grants/inactive legacy products.
- Existing Full Access overrides and existing legitimate stage grants remain honored.
- Refresh/relogin authorization reads persisted ownership through the existing authenticated access path; it does not depend on a browser purchase flag.
- Owners retain historical Premium snapshots. Non-entitled Free customers receive final settlement facts without Premium historical vectors in report HTML/PDF/DTO.
- Existing strict Free/Premium intelligence contracts, comparison safeguards and shadow exclusions remain covered by the full regression suite. No ML engine policy, weights, forecasting mathematics or probabilities were changed.

## 7. Validation results

| Check | Result |
|---|---|
| Full customer suite | 372 passed, 33 files |
| New V2 automated coverage | 71 passed across 8 new test files |
| Isolated database assertions | 39 passed |
| Real concurrent database checkout | One accepted; overlapping checkout rejected |
| Real concurrent fulfillment | Both calls acknowledged; one entitlement |
| Runtime staging checks | 13 passed: four tables, two RPC rejection paths, two pages, three auth checks, two existing inventory reads |
| TypeScript | Passed |
| ESLint | Passed |
| Production-mode build with V2 enabled and isolated staging configuration | Passed |
| Local Supabase security advisors | No issues found |
| Whitespace check | `git diff --check` passed |

Runtime: `/matches?competition=all` and `/how-it-works` returned 200. Anonymous quote, initialization and Premium requests returned 401. Both isolated staging upcoming feeds returned 200 with zero stored records. Schema tables and RPCs were reachable through the actual isolated Supabase Data API, not only through mocked clients.

Evidence: `output/pricing-v2/customer-tests.json`, `output/pricing-v2/database-results.json`, `output/pricing-v2/runtime-results.json`.

The staging `public_predictions` row hash before and after the concurrent database tests was `d41d8cd98f00b204e9800998ecf8427e`. This is the empty-table hash: it demonstrates that this staging table remained untouched, not an immutability test against genuine nonempty forecasts. Production forecast vectors were not queried or modified.

## 8. Outstanding validation blockers

1. The isolated staging environment has no Paystack TEST secret. Provider initialization/success/failure/metadata/replay paths passed mocked automated tests; an actual TEST-provider callback and manual refresh/relogin purchase journey remain unverified. No live credential was substituted.
2. The existing isolated staging Premium and Free upcoming feeds have zero stored records in the customer four-day query window. The populated genuine-data selection/Premium/browser journey remains unverified. This does not claim there are no eligible fixtures at the provider; the engine was not changed or run to generate forecasts.
3. Held changed-fixture/ambiguous/late-payment cases require operational reconciliation. They are safely visible in the basket ledger; no automatic refund workflow was added.

## 9. Compatibility and activation

`PREDICTIVE_CUSTOMER_PRICING_VERSION=v2` explicitly activates the customer feature after the migration is applied. It is not set in production. The guarded staging helper sets it only after validating isolated infrastructure and TEST payment mode. Its UI-only smoke mode uses loopback 3102 and clears Paystack credentials in that process, leaving the existing server on 3100 alone.

Forecast source configuration is unchanged. Customer Free/Premium intelligence schemas are unchanged; V2 does not place invented product IDs into the existing live API offer schema. Legacy stage offers are suppressed while V2 is active, and match checkout uses actual canonical match IDs independently of those legacy products. The initial sales eligibility remains available stored upcoming prematch forecasts before kickoff; this work does not invent a new post-kickoff sales window. Owned matches retain later-stage/history access.

The legacy admin Overview/Payments/Access/export views continue to describe their original stage-product ledger. V2 basket transactions/permanent grant counts are shown separately at `/admin/baskets`; merging the two revenue summaries/exports is not included. Customer account payment history merges both ledgers.

No genuine missing forecast/live stage is fabricated. The independent Free source and all ML/shadow/research/Decision Intelligence policies remain untouched. New commerce quotes contain fixture identity and pricing only, never forecast probabilities or internal engine objects.

## 10. Production readiness

Implementation is ready for code review. Production activation is not approved and the genuine-data/provider purchase journey is still pending. Review the new historical-snapshot security boundary and separate basket operational ledger before accepting the release.

After review approval, the planned order is additive migration, deployment, then explicit V2 activation and approved production verification. None of those production steps were performed here.

**READY FOR PRODUCTION ACTIVATION: NO**
