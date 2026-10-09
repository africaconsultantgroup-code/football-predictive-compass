# Premium purchase CTA repair

The match card now has an explicit **Add to Basket** action beneath Premium
Match Intelligence and the GH₵8 single-match starting price. The title links to
the match preview. Added fixtures show Added ✓, Remove and View Basket. Mobile
has a sticky selection bar above the bottom navigation; desktop retains the
basket summary. Totals come from the server quote, including multi-match pricing.

The production route remains:

`MatchRow → MatchSelection → MatchBasket/BasketCheckout → POST /api/payments/matches/quote → calculateMatchBasketPrice → POST /api/payments/paystack/initialize → initializeBasketPayment → existing Paystack callback/webhook verification → verifyBasketPayment → finish_match_basket → customer_match_entitlements`.

No second checkout architecture, pricing policy, schema migration, provider
inventory call, ML Engine change, environment change or real Paystack charge was
introduced.

Existing pending Pricing V2 payments resume their stored, validated Paystack
URL. Unresolved initialization requires payment-status verification, retaining
the original reference and reservation. Legacy pending payments use verification
because their production table has no stored authorization URL. Both pending
queries were verified read-only against production, scoped to a synthetic user
ID, and returned HTTP 200 with zero rows. Customer scoping and safe projection
are tested. A query failure blocks quoting with a recoverable error.

Owned/Full Access match views have View Match Intelligence without a purchase
CTA. Closed fixtures disable purchasing and explain why. Quote expiry disables
payment and offers a new quote. Selection changes discard stale quote responses.

Validation: 444 tests across 39 files passed; 11 local HTTP checks passed;
TypeScript, lint, production build and diff whitespace checks passed. Thirteen
DOM interaction cases exercise real cards, quote/initialization routes and
payment services with fake database/Paystack boundaries. They cover ordinary
purchase through permanent entitlement and replay, removal, pending checkout,
ambiguous initialization, access states, closing/expiry, cross-day selection,
stale quotes, double clicks and sign-in recovery. No live payment was performed.

Browser/session automation is unavailable. Fresh authenticated mobile checks
and measurements of the new basket bar at 320px/375px remain manual verification;
DOM tests do not establish rendered viewport geometry.
