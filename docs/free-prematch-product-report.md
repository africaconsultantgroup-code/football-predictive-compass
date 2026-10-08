# Free pre-match product implementation

## 1. Existing sources audited

Read-only source audit of `.staging/main-customer-repairs` (verified engine main checkout), plus the customer application contracts/loaders. No production database inspection or mutation was needed or performed for this task.

| Source | Existing signal path | Suitable for public free probabilities? |
| --- | --- | --- |
| Customer Combined | `app/domains/football/adapter.py` selects valid stored `live_context.production_decision.combined_probabilities`; preserves the approved canonical fallback | No: premium forecast |
| Champion | `app/football/model.py` starts with historical strength/form features, but the contextual model family also reads formation, referee and reported availability. `predict_fixtures` then applies `PredictiveEvidenceCompiler` and `GIProbabilityIntegrator` to current GI evidence | No: not isolated to early/basic inputs |
| Unified | `app/football/unified_candidate.py` consumes baseline, market, expected composition, manager, configuration, player/unit ratings and absence/replacement context | No |
| Market | `app/football/production_decision.py` validates bookmaker fair probabilities, source coverage and freshness | No: market intelligence |
| Combined/forecast revisions | `production_decision.py`, `forecast_engine.py`, `verification.py` use premium components, World State/context, contradiction and revision signals | No |
| Baseline/rollback/original vectors | Production decision baseline begins from the existing post-integration prediction, rather than an independently approved free forecast | No |
| GI raw baseline trace | Internal `gi_causal_trace.base_probabilities` is a diagnostic trace; model family and input isolation are not certified for the proposed product | No: neither a public publication nor guaranteed free-only |
| Lightweight reader / staged snapshots | `lightweight_predictions.py` reads existing stored versions; staged snapshots contain contextual/lifecycle information | No: another reader/version is not a separate free signal boundary |
| Historical/research snapshots | Research timing labels and experimental predictors do not establish approved customer-free provenance | No |

The audit findings were reported before implementing the contract. There is no trustworthy approved stored free forecast in the audited architecture. Champion was not assumed safe.

## 2. Selected source

**No probability source selected.** Production free status is `unavailable`. Identity metadata is projected from existing upcoming records; their premium vectors, summaries, prediction IDs and diagnostics are never used in the free response. This is not Combined rebranded as free.

The available contract and rendering branches are exercised with synthetic unit-test fixtures only. They are not wired to an existing engine source, environment switch or forecast recomputation.

## 3. Data included

Currently: match ID, competition, home team, away team, kickoff, fixed PREMATCH stage/free tier, availability status. Unavailable probability, outcome and generation time are explicitly null. Basic Match View only states the fixture's home/away identity and competition.

The future available contract permits only those identity fields, stored H/D/A percentages, most likely outcome and generation timestamp. It validates finite percentages, a total of 100 within rounding tolerance and a most likely outcome consistent with the stored vector. It does not calculate or normalize a forecast. No free form/explanation text is accepted until its own content policy can be enforced.

## 4. Deliberately excluded

Confirmed starting XI; confirmed tactical/formation information; late injury, suspension and availability changes; late manager changes; premium World State; bookmaker/market movement; late revisions and contradiction signals; live/halftime data. Also excluded: paid score/reliability/summary/factors, refresh diagnostics, raw evidence, Champion/Unified/Market/Combined identifiers, calibration/research information, shadow probabilities/IDs, experiment IDs, candidate policy metadata and private model metadata.

The strict free schema rejects extra fields at the response boundary rather than serializing them. Field validation is a transport boundary, **not proof of signal provenance**. A future source must be independently approved before connecting it.

## 5. API and contract

`GET /api/football/matches/[matchId]/free` is public, including without a session, and returns only the strict free contract. Known upcoming PREMATCH match: HTTP 200 with unavailable status. Invalid ID: 400; match absent from the existing upcoming window: 404; dependency failure or invalid payload: 503 with a generic message. Responses are no-store. Mismatched source match IDs are rejected.

The server provider reads existing upcoming records using GET with product synchronization disabled. It never invokes the freshness POST or another forecast generation operation. Existing premium callers retain their default product synchronization behavior. This initial metadata discovery is limited to the existing today-plus-four-days upcoming window; broader fixture discovery requires a dedicated fixture endpoint.

## 6. Files changed for this task

- `lib/predictive-compass/free.ts`: strict public contract, identity-only unavailable projection, public response handler.
- `lib/predictive-compass/free-server.ts`: fail-closed source provider.
- `lib/predictive-compass/server.ts`: optional disabling of product synchronization for the new read-only metadata request; existing default preserved.
- `app/api/football/matches/[matchId]/free/route.ts`: public GET wrapper.
- `app/matches/match-components.tsx`: separate free list rendering.
- `app/matches/[matchId]/page.tsx`: free detail and purchased content composition, matches theme.
- `app/matches/free-detail.tsx`, `free-detail.css`: free experience and premium upgrade panel.
- `app/checkout-button.tsx`: optional display label only; existing checkout request/body/login/payment behavior unchanged.
- `app/matches/match-components.test.tsx`: prior dashboard tests updated for genuine free separation.
- `app/matches/free-product.test.tsx`, `lib/predictive-compass/free-server.test.ts`, `free-readonly.test.ts`: new regressions.
- This report.

Pre-existing workspace changes, including the earlier dashboard redesign and unrelated payment changes, were retained. No engine files were edited.

## 7. Matches list

Always labels the public summary FREE PRE-MATCH and links to View Free Prediction. Current records show unavailable without numbers. Paid ownership does not substitute the premium vector into that summary. A dedicated available free contract renders its own H/D/A vector; match identity and PREMATCH stage must match. Premium access options remain separate.

## 8. Match detail

White/blue free detail includes existing fixture header, competition, kickoff and Pre-Match stage, free badge, availability, concise basic view and probability disclaimer. An available approved free contract can render a large outcome/probability and three-outcome visualization. Currently no free probabilities are published.

Purchased premium content remains behind the existing `hasPredictionAccess` check. Its valid-snapshot fallback and delivery checks were preserved. Existing freshness POST on detail-page navigation was retained for premium readiness/offer handling; the new free API itself does not call it. Premium freshness diagnostics are shown only with paid access. An existing full detail dependency outage still blocks checkout and shows the service-unavailable state.

## 9. Checkout

Upgrade copy describes latest team news, availability, tactical information, conditions and market intelligence without internal engine names. Real backend offers supply currency/price/product ID. Match CTA is Unlock Premium Pre-Match and uses the existing CheckoutButton/Paystack flow. Kickoff-slot scope retains its existing label. No GHS20 price is hardcoded in this upgrade panel. Owned access shows Premium Intelligence Unlocked and no purchase button. Undeliverable snapshots/missing offers/missing prices cannot start checkout from this panel. No GHS25 or Matchday Pass implementation was added.

## 10. Validation

- Full customer suite: **209 passed, 19 files** (184 previous tests retained; 25 additional cases).
- New coverage: anonymous valid-contract retrieval; forbidden field rejection; premium-to-free identity-only projection; unavailable/unknown/error states; vector/outcome validation; cross-match rejection; list/detail free rendering; real offer pricing; owned/blocked checkout; no live source relabeling; read-only GET and product-sync suppression with premium default retained.
- Existing authentication, access-grant, entitlement, purchases and payment suites passed.
- TypeScript `tsc --noEmit`: passed.
- ESLint: passed.
- Production build: passed (final validation recorded after implementation).

These are local contract/rendering tests, not proof that a production free model exists. No production free probabilities are enabled.

## 11. Required backend work

Provide a separately persisted, approved early/basic PREMATCH publication with an explicit input allowlist and cutoff policy. Candidate inputs are historical strength, longer-term form, basic previous results, baseline expected performance and stable early match context. Approve the exact cutoff and feature definitions before activation. Demonstrate that training/features, evidence integration and subsequent revisions cannot introduce the excluded premium inputs indirectly.

Persist the vector and private provenance/cutoff/input audit separately from the customer response. Expose a dedicated read-only server source, verify its independence from premium forecasts, then connect that provider to both list/detail/API paths. Never fall back to Combined, Champion, Unified, Market or shadow when the free publication is absent. Additional migrations/model work require separate authorization; none were implemented here.

## 12. Production safeguards

No commit, deployment, migration, production backfill, production data write or forecast recomputation was performed for this task. `PREDICTIVE_CUSTOMER_PREDICTION_SOURCE=combined`, model mathematics, weights, Decision Intelligence, calibration, shadow/research policies, settlement and entitlement/payment logic were not changed by this implementation.
