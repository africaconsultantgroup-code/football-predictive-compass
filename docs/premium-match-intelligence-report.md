# Premium Match Intelligence — local implementation

Validation date: 7 October 2026. Work remains uncommitted and undeployed. Existing unrelated workspace changes were preserved.

## 1. Premium source audit

The paid path uses the existing Football Domain customer projection. In the engine checkout, `app/domains/football/adapter.py::_customer_prediction` prefers valid stored `live_context.production_decision.combined_probabilities`, including legacy records whose canonical vector was Champion. It validates the three finite probabilities and their sum, then uses the stored vector. The existing approved canonical fallback remains when Combined is unavailable. This work does not alter that selection.

`production_decision.py` resolves `PREDICTIVE_CUSTOMER_PREDICTION_SOURCE` during generation. The approved production setting is `combined`; no environment setting was changed or independently reverified against production during this UI task. The repaired customer read adapter also prefers stored Combined. Component names and engine names are absent from the premium customer DTO and UI.

`repository.py::PREMATCH_BY_MATCH_SQL` selects the latest non-superseded PREMATCH snapshot for the match, excluding insufficient snapshots. Lifecycle revisions supersede earlier versions; customers do not select arbitrary V1/V2 or shadow IDs. The existing freshness endpoint and `paidPrematchSnapshot` determine delivery. The prior future-PREMATCH fallback after a core-service error is retained.

## 2. Files changed in this phase

- `app/matches/[matchId]/page.tsx`: premium-first entitled detail, accurate purchase presentation, preparing state, preserved offers/access/freshness.
- `app/matches/premium-components.tsx`, `premium.css`: reusable hero, comparison/change, reasons, pick, opportunities, score, summary and freshness; responsive white/blue styling.
- `app/matches/free-detail.tsx`: reusable standalone Free card and Unlock Premium button label; existing checkout implementation retained.
- `lib/predictive-compass/premium.ts`: strict premium DTO, projection, comparison, deterministic summary and endpoint handler.
- `lib/predictive-compass/premium-server.ts`: existing authentication/entitlement checks and stored paid snapshot loading.
- `lib/predictive-compass/premium-purchase.ts`: read-only successful-payment lookup used only for the Purchased badge.
- `app/api/football/matches/[matchId]/premium/route.ts`: protected GET endpoint.
- `app/matches/premium.test.tsx`, `premium-page.test.tsx`, `lib/predictive-compass/premium-server.test.ts`: new coverage.
- `app/matches/free-product.test.tsx`: existing CTA label expectation updated.
- This report. Temporary visual-render test was removed after producing an ignored local fixture.

Earlier Free engine/UI work and unrelated dirty files are not new changes in this phase.

## 3. Customer-safe contract

Available premium DTO: fixture identity, teams, competition, kickoff, PREMATCH stage, premium tier, availability status, H/D/A percentages, most likely outcome, generated/updated times, empty explanation/recommendation arrays and null pick/advanced score. Explicit projection copies the stored customer probabilities without recomputation. Strict validation rejects malformed distributions, inconsistent leaders, extra DTO keys and mismatched fixtures.

Internal prediction IDs, engine components, World State/evidence JSON, provider payloads, weights, policy/experiment IDs, research/shadow/calibration fields, raw summaries and factors are omitted. Endpoint responses use `Cache-Control: private, no-store`. Anonymous requests return 401 and non-entitled requests 403 before premium loading. Authorized unavailable responses return 503 with only match identity, premium tier and preparing status.

## 4. Free/Premium comparison

Both forecasts remain distinct. Comparison requires valid available DTOs, matching ID/teams/competition and equivalent kickoff instants. Original generated timestamps must be ordered Free <= Premium <= now and both precede kickoff. A later refresh timestamp cannot make an older forecast appear newer. Missing/unsafe comparisons are omitted. Each H/D/A difference is measured independently in percentage points; changed leaders are named, never compared by subtracting probabilities for different outcomes. No accuracy superiority claim is made.

Synthetic regression fixture: Free 50/32/18 and Premium 58/25/17 displays +8/-7/-1 pp. It is not represented as a production record.

## 5. Explanation categories

No approved structured category publication was found. Existing customer copy is derived from probabilities/basic score and cannot establish genuine team-news, availability, tactical, conditions, market, schedule or formation causes. Reasons therefore show an explicit unavailable state. No category is inferred merely from a probability change.

## 6. Compass Pick

No approved customer market-selection publication was found. Displays “Compass Pick not available yet”; no betting selection is derived from 1X2 probabilities.

## 7. Ranked opportunities

No approved ranked customer betting-market output was found. Displays the empty state; no bookmaker-odds inference or new recommendation engine was introduced.

## 8. Correct score

The older customer projection contains a nullable basic predicted score, which can be cleared when Combined replaces a different canonical vector. The audit did not establish a validated advanced correct-score source. Premium deliberately shows “Advanced score intelligence coming later” and publishes no score. No score system was added.

## 9. Checkout and entitlement

Existing `hasPredictionAccess`, grants/capabilities, backend offers and checkout remain authoritative. Locked customers receive Free and actual offer prices; tests use a GHS23 backend offer to guard against hardcoded GHS20. Entitled customers have no purchase CTA. A successful payment tied to the user, pre-match product, match and non-null grant enables Purchased ✓ presentation only; other valid access shows Access active. Payment evidence cannot grant access. Existing completed-match delivery restrictions and My Predictions/report access remain in place.

## 10. Missing data

Missing paid data displays “Premium forecast is being prepared” with access preserved. Free remains a separately labelled reference; it is never relabelled premium. Missing Free leaves Premium usable. Checkout remains blocked when a valid deliverable snapshot/offer is absent. Missing times show unavailable; only the existing queued/in-progress lifecycle state can announce a check underway. No next lineup update is invented.

## 11. Mobile

At <=720px, hero, comparison and opportunity/score panels stack; no large table is used. DOM priority is match header, premium forecast, comparison, pick, reasons, opportunities, score, summary/freshness and separate Free reference. Local browser QA at a requested 390px viewport verified single-column comparison/opportunities and equal document client/scroll width (375px). This used SSR components with synthetic fixtures and raw local CSS, not a production authentication or purchase flow.

## 12. Validation

- Full customer suite: **279 passed, 23 files**; baseline before this phase was 221 tests.
- New coverage: 41 premium contract/product cases, 10 loader/authorization/payment-presentation cases and 7 actual server-page integration cases.
- Focused engine suite: **74 passed, 1 skipped** across customer Combined selection, SQL timeout regression, Football Domain API, pre-match freshness, lifecycle and Free pre-match tests. The skip is the existing configured integration guard. Initial sandbox execution hit temporary-file permissions; rerunning with authorized local filesystem access passed. Existing Starlette deprecation and pytest cache warnings remain.
- TypeScript `tsc --noEmit`: passed.
- ESLint: passed.
- Production `next build`: passed, including dynamic premium API and match detail routes.
- Temporary synthetic visual-render test: 1 passed, removed afterward; not included in the 279 count.

Security/product tests cover anonymous and locked denial before loading, paid access, every excluded internal field class, Free endpoint isolation, fixture/time comparison guards, delta arithmetic, leader change, missing forecasts, real offer display, subscription versus purchased presentation, preserved paid fallback and expired/completed checkout restrictions. Existing checkout, authentication and entitlement suites are included in the full run. No real payment was initiated.

## 13. Remaining backend requirements

Approved structured, customer-safe evidence categories tied to fixture/snapshot and supported facts; an approved Compass Pick/ranked-market publication contract with provenance and ranking; a separately validated advanced correct-score publication. These must be implemented and approved before enabling those outputs. The current strict DTO intentionally rejects unsupported additions until that contract is extended and tested.

## 14. Engine integrity

No engine source changed in this phase. No model mathematics, weights, source policy, Decision Intelligence, shadow/research policy or stored probabilities changed. Prior local Free work remains untouched. No production data operation or manual forecast rewrite occurred.

## 15. Release boundary

No commit, deployment, production migration, production worker activation or new paid product activation occurred. The Premium experience is locally implemented and validated. Production source/endpoint checks from earlier tasks were not rerun or claimed as new verification here.
