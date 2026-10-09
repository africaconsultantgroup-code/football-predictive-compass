# Customer Pricing V2 GH₵8 replacement review

Local implementation complete. Production untouched. No commit, push, merge, deployment, production migration or ML Engine change. V2 still requires deliberate activation after both customer commerce migrations; the flag remains `PREDICTIVE_CUSTOMER_PRICING_VERSION=v2`.

## Approved prospective pricing

| Matches | Basket GH₵ | Paystack pesewas | Effective GH₵ per match |
|---:|---:|---:|---:|
| 1 | 8 | 800 | 8 |
| 2 | 15 | 1500 | 7.50 |
| 3 | 21 | 2100 | 7 |
| 4 | 27 | 2700 | 6.75 |
| 5 | 33 | 3300 | 6.60 |
| 6 | 39 | 3900 | 6.50 |
| 7 | 45 | 4500 | ≈6.43 |
| 8 | 51 | 5100 | ≈6.38 |
| 9 | 57 | 5700 | ≈6.33 |
| 10 | 63 | 6300 | 6.30 |

The server uses the explicit table in `lib/payments/match-pricing.ts`. Quantities above ten are rejected; there is no interpolation. Five matches have a server-calculated regular price of 4000, total of 3300 and savings of 700 pesewas.

The exact effective price is the stored rational `total_pesewas / match_count`. `unit_pesewas` is an exact integer where divisible and NULL for quantities 7, 8 and 9. Display approximation never becomes the charged amount. Individual post-match receipt allocations distribute the integer remainder in sorted match-ID order and sum exactly to the immutable basket total. This does not change the payment or stored quote.

## Schema and history

`20261008205000_customer_match_pricing_v2_ghs8.sql` is additive/corrective after the original local commerce migration. It removes the universal `total = integer unit × quantity` and four-tier constraints, allows nullable unit, and enforces the exact approved table for `daily-match-v2-ghs8`. Historical quote versions retain their original integer-unit constraints and amounts. The immutable quote trigger remains enabled. There are no UPDATE/DELETE statements against quotes, payments, forecasts or entitlements in this correction migration.

`accept_match_basket` rejects an unaccepted old quote, but an already-bound payment remains recoverable and verification continues using its original quote. No historical receipt, reference, paid amount, ownership or legacy callback is repriced. Regression coverage verifies a stored historical GH₵64 basket and GH₵20 legacy purchase at their original amounts.

Only the fixed local Docker database `supabase_db_predictive-compass-customer-staging` received this migration. Rollback-only database tests left all four commerce tables empty. Staging forecast-row hashes before/after are both `d41d8cd98f00b204e9800998ecf8427e`; this is an empty-table invariant, not evidence from genuine populated forecasts. No forecast generation or writes occurred.

## Relevant legacy price inventory and disposition

Search covered application, library, scripts, migrations, database tests and documentation for 500/800/1000/2000, GHS and GH₵5/8/10/20, tier values, product prices and pricing lookups. Secret environment files were excluded.

| Reference | Classification and disposition |
|---|---|
| `lib/payments/match-pricing.ts` previous 2000/1800/1600/1500 tier policy | Replaced with the ten approved totals and a new immutable policy version. |
| `app/how-it-works/page.tsx` old four-tier education | V2 now displays all ten approved totals and effective prices. V2 never queries legacy pricing rules. |
| `app/matches/match-basket.tsx` selection, single checkout, basket breakdown | Standard price comes from 800; breakdown comes only from returned server quote. No browser amount accepted. |
| `app/matches/match-components.tsx` GH20/GH25/GH48 preview constants | Pre-activation legacy rendering only; disabled preview controls never price checkout. V2 rendering bypasses these controls and shows central GH₵8. Matchday Pass remains unavailable. |
| `lib/payments/service.ts` database product prices and GH10 minimum | Legacy initializer explicitly returns `LEGACY_PRICING_RETIRED` before database/provider access whenever V2 is active. Verification/history remains intact for older transactions. |
| `/api/payments/paystack/initialize`, legacy checkout button | With V2 active, route accepts only a strict quote ID; product IDs, supplied amounts and alternative currencies cannot select legacy prices. No fallback. |
| `lib/auth/match-access.ts` product offer lookup | V2 returns no legacy offers for any stage; existing grants and Full Access permissions remain valid. |
| `lib/payments/pricing.ts`, `product-sync.ts`, older SQL pricing/finalization functions | Pre-activation legacy infrastructure retained for deployment ordering and history. V2 customer reads skip legacy synchronization and new payments cannot use these products. No old price is an alternative V2 offer. |
| Admin legacy product/payment lookups, account receipts, post-match historical fixtures | Historical ledger amounts preserved. New basket ledger displays stored total and effective price. |
| Tests with 1000/2000 and GH10/GH20 | Intentionally legacy verification, decimal conversion, activation-off compatibility and historical receipt fixtures; preserved. New pricing/Paystack tests assert all ten approved totals. |
| First V2 migration and superseded review | Historical checkpoint retained; corrective migration applies prospectively. Earlier review explicitly marked superseded. |
| 500/800/1000 in CSS, HTTP errors, validation lengths, timeouts, timestamps, row limits, ports and test UUIDs | Non-price references; unchanged. No GH₵5 active V2 checkout path exists. |

Once activated, all new purchases use the quote path. Activation-off legacy behavior is retained until release approval; it cannot be selected alongside V2.

## Quotes, payments and access

One immutable authenticated quote covers unique eligible future Premium matches across supported competitions on one Ghana calendar day. Already-owned matches, duplicate IDs, mismatched identities, moved kickoffs, expired quotes and cross-day selections are rejected. Quote expiry remains ten minutes. JSONB key ordering cannot falsely invalidate a stored quote.

Paystack receives exactly `String(storedQuote.total_pesewas)`, GHS, and server-created reference/payment/customer/quote/policy metadata. One transaction funds the basket. Verification checks every bound field against stored records and never re-prices an accepted payment using the current table. Provider responses and shadow objects cannot become entitlement authority.

Successful verification atomically grants permanent full-match ownership; repeated callbacks acknowledge success without duplicate grants. User advisory locks and unique match reservations prevent overlapping checkouts. Free/Premium boundaries, authenticated checkout and existing Full Access overrides remain unchanged. Owned matches cannot be repurchased; Premium stage access and historical review remain unlocked.

## Held-payment operations

Ambiguous initialization retains the original reference/reservations; no second charge is initialized. Verify that same reference via account/callback. Provider pending and mismatched/changed-fixture/late-success states do not grant access. Definitively verified failed/abandoned/reversed states release reservations. Held `grant_failed` cases remain visible in `/admin/baskets` with quote identity, original total, reference and grant count.

Operations must compare the provider's verified reference, amount, currency and metadata to the original immutable quote, then inspect ownership/reservations and fixture identity. Retry the existing verification for transient outages. A genuine fixture mismatch or late success after released reservations requires manual support reconciliation/refund through the existing provider process; no automatic refund, forced entitlement or replacement checkout was added. Never edit the stored quote or charge again to clear a hold.

## Validation and limitations

- Full `npm test`: 977 passed, 82 files, no failures. This includes preserved `.staging` checkpoint copies; the current repository contributes **393 passed in 34 files**, including all prior customer coverage and 92 V2 tests.
- Database: **53 pgTAP assertions passed**, transaction rolled back.
- Real independent PostgreSQL connections: overlapping checkout accepted once, second rejected; concurrent fulfillment acknowledged twice with one entitlement.
- TypeScript and lint: passed.
- Production-mode V2 build using isolated staging environment: passed, no deployment.
- Runtime: **13 checks passed**. `/matches` and `/how-it-works` HTTP 200, all ten totals rendered, quote/init/Premium unauthorized requests HTTP 401, tables and RPCs reachable. No Matchday Pass or GHS25 alternative displayed.
- Stored staging upcoming Premium/Free inventory: zero. Paystack TEST secret absent. Genuine entitled basket UI and real TEST checkout remain unverified; mocked provider tests check exact outgoing amounts for every quantity. No live credentials, real charge or manufactured forecast substituted.

Evidence: `output/pricing-v2/customer-tests.json`, `database-results.json`, `runtime-results.json`.

## Files changed by this correction

`lib/payments/match-pricing.ts`, `match-pricing.test.ts`, `basket-service.test.ts`, `service.ts`, new `legacy-pricing-retired.test.ts`; `lib/reports/post-match.ts`, `post-match-v2.test.ts`; `app/matches/match-basket.tsx`, `pricing-v2.test.tsx`; quote route test; `app/how-it-works/page.tsx`; `app/admin/baskets/page.tsx`; corrective migration; pgTAP suite; database/runtime regression helpers; this report and superseded review notice. Earlier uncommitted V2 implementation and pre-existing work remain preserved.

**PRICING V2 GH₵8 REPLACEMENT: READY** — locally validated correction, not authorization for production activation. Production activation and genuine provider checkout validation remain separate pending work.
