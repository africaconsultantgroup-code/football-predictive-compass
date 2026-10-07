# Independent FREE pre-match forecast — local implementation

## 1–4. Audited, allowed, premium and ambiguous signals

See [the detailed signal classification](free-prematch-v1-signal-audit.md). The classification was communicated before model wiring. No existing final probability source was selected.

Allowed inputs are fixture identity, competition, home/away and regulation-time FT result history observed before generation. The exact model features are `home_elo`, `away_elo`, `elo_difference`, `home_form_points`, `away_form_points`, `home_goal_difference`, `away_goal_difference`, `home_matches`, `away_matches`. They represent rebuilt Elo, fixed home advantage, five-result form/goal difference and capped match count.

Odds, lineups, availability, formations, tactical changes, late news, World State, contradictions, revisions, live/halftime state, premium/Combined and shadow forecasts are excluded. Existing xG, saved states, archives without knowledge timestamps and incomplete rest information were excluded as ambiguous. No explanation text or confidence was fabricated.

## 5. Architecture

`free_prematch_v1` is a separate results-only generation and publication path. It uses strict frozen fixture/result inputs, a fixed feature allowlist, immutable insert-once storage, an independent opt-in worker and dedicated read endpoints. Premium generation, World State and settlement do not invoke it.

Engine work lives in the local engine checkout `.staging/main-customer-repairs`; customer work lives in the root application. Both remain uncommitted.

## 6. Existing capability reused

Reused the existing baseline chronological training-row/feature builders from `app/football/model.py`. That file and its mathematics were not edited. A separate LogisticRegression classifier is fitted with StandardScaler using those restricted rows. No existing fitted bundle, saved state, final Champion vector, GI-integrated result or premium probability is reused. This is a separately fitted baseline using existing infrastructure, not a premium forecast with fields removed.

## 7. Exact generation path

API-Football `fixtures_for_competition` → explicit NS fixture / FT full-time result projection → strict `EarlyFixture` / `BasicResult` → competition/cutoff/age filtering → chronological basic training rows → verify the nine-feature allowlist → StandardScaler + LogisticRegression (`max_iter=2000`, default regularization, no class balancing/calibration) → independently predict H/D/A → validate finite 0..1 values and sum 1 → immutable `FreeSnapshot`.

The private version identifies policy, sklearn version, algorithm and training-input hash. Private provenance stores the full restricted result inputs, their observation times, result references, feature names and input hash. Internal engine vectors use 0..1; public percentages round to two decimals using the platform convention (sum can differ from 100 by at most 0.01 from rounding). The most likely outcome is selected from the published vector. No confidence threshold or confidence value is introduced.

Generation requires at least 20 historical rows, all three outcome classes, and both target teams present in the filtered history. These are data sufficiency checks, not customer confidence thresholds. Otherwise no forecast is created.

## 8. Timing policy

First successful prospective capture, **24 hours to seven days before kickoff**. The cutoff equals actual generation time after provider responses are received; response observation times are recorded after each request. Historical results must have kickoff at least 24 hours before that cutoff. This deliberately conservative rule excludes recently finished results as well as later observations.

No retroactive kickoff-minus-24-hour snapshot is manufactured after that deadline. A late-discovered fixture remains unavailable. No automatically advancing cutoff or late refresh exists.

## 9. Immutability

One finalized v1 snapshot per workspace/match/policy. Worker checks stored existence before model fitting. Insert uses `ON CONFLICT DO NOTHING`, then returns the persisted original. Concurrent inserts have one winner; retries do not change its vector, cutoff, generation timestamp or input provenance. Strict snapshot validation also rejects late generation/cutoff violations.

SQLite and PostgreSQL enforce mutation rejection at the database layer. PostgreSQL rejects UPDATE and DELETE, including payload/timestamp changes. PostgreSQL auto-created staging tables install the same protection. No unchanged-refresh update operation exists.

V1 has no correction/refresh action. A future explicitly approved correction/version lifecycle must append an immutable record under a separately defined selection/version policy; it must not overwrite this record. Where current customer fixture identity/kickoff differs from a stored snapshot, customer list/detail fail closed. The standalone source returns the original frozen fixture metadata; it is not a current-schedule authority.

## 10–11. Storage and migrations

New isolated table: `football_free_forecasts`. Existing premium prediction versions and shadow tables have different mutable/supersession/evaluation lifecycles, so sharing them would threaten isolation. The new table has an immutable snapshot ID, workspace, public match ID, policy, indexed kickoff/generation time and private JSON provenance/vector payload. Unique workspace/match/policy prevents retry duplicates; composite workspace/policy/kickoff index serves upcoming reads.

The Supabase CLI created `20261007184730_free_prematch_v1.sql`; identical local files are in:

- `.staging/main-customer-repairs/supabase/migrations/20261007184730_free_prematch_v1.sql`
- `.staging/main-customer-repairs/app/storage/migrations/20261007184730_free_prematch_v1.sql`

The packaged copy supports the existing engine migrator. Migration adds only this table/index/immutability function/trigger and permissions. RLS is enabled; public, anon and authenticated have no table privileges. Service role has SELECT/INSERT only; private payloads are exposed solely through the server whitelist. This follows the [Supabase RLS/grant guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

Migration was applied only to a disposable localhost PostgreSQL 17 database for tests, never production. No existing forecast tables were changed.

## 12. Worker integration

Independent worker entrypoint: `python -m app.football.free_worker`, optional `--once`, `--workspace` and `--interval`. It reuses provider/competition/database infrastructure and captures Premier League and Champions League separately. It is **disabled by default**, requiring `PREDICTIVE_FREE_PREMATCH_ENABLED=true`. No existing environment file was changed.

The separate process prevents provider latency or fitting from delaying premium/live work. `learning_worker.py`, Railway configuration and existing premium worker entrypoints are unchanged. `compose.free-staging.yaml` supplies an explicitly opt-in local/staging `free` profile with CPU/memory limits. This profile was not activated with real provider credentials.

## 13. Customer API

Engine service endpoints:

- GET `/api/v1/domains/football/free/upcoming?from=...&to=...`
- GET `/api/v1/domains/football/matches/{matchId}/free`

Existing domain service authentication/scope checks remain required. Reads use the separate table and indexed queries with statement timeout. No forecast generation or premium query is performed by these endpoints.

The existing public customer GET `/api/football/matches/[matchId]/free` consumes only the dedicated stored free source. Its strict schema rejects internal/premium fields. Missing free data may use premium records for **identity-only unavailable metadata**, never probabilities. Service secrets remain server-side. Customers receive fixture identity, PREMATCH/free tier, availability, H/D/A percentages, most likely outcome and generation time only.

## 14. UI

List fetches the stored free list separately from paid data. Existing rows show the free vector only when fixture identity/kickoff match. Free-only fixtures can appear before premium snapshots exist, and remain visible when the premium list is unavailable. They do not invent premium prediction/product IDs or enable checkout.

Match detail reads the stored free snapshot and displays the existing free outcome/probability layout. It can display free content even when premium freshness fails. Paid content still uses existing entitlement, delivery and fallback checks. A missing/mismatched free source remains unavailable; premium is never substituted.

Real backend offer pricing and existing GHS20 premium purchase flow remain unchanged. No GHS25 or Matchday Pass payments were enabled. Owned access suppresses purchase; free-only rows route to detail for authoritative access/offer checks.

## 15. Evaluation / settlement

`free_evaluation.py` adds local/offline scoring of a frozen free snapshot against a matching regulation-time result: multiclass Brier score and log loss, with snapshot/source identity. It rejects mismatched targets and leaves the forecast untouched.

Production settlement, feedback, policy learning and calibration remain unchanged. Future work must add separate persisted free evaluation records and an approved comparison cohort for Free/Champion/Unified/Market/Combined. No evidence currently establishes that Premium outperforms Free; that requires prospective settled data and calibration/performance analysis.

## 16. Validation

Final validation:

| Check | Result |
| --- | --- |
| Focused free generation/worker/API/evaluation tests | 32 passed |
| PostgreSQL migration, permissions and immutability tests | 9 passed (included in final full suite) |
| Full engine suite including local PostgreSQL | 799 passed, 3 skipped |
| Full customer suite | 221 passed, 20 files |
| TypeScript | Passed |
| ESLint | Passed |
| Next production build | Passed |

Coverage includes allowed signals; odds/lineup/availability/World State/Combined/shadow exclusion; normalized probabilities; future-only timing; unknown-data failure; worker retry/no-change preservation; database mutation rejection; public whitelist; service authentication; stored-source customer transport; list/detail rendering; free-only fixtures; and existing paid entitlement/payment regressions. Real PostgreSQL tests additionally validated the migration twice, customer-role denial, service-role privileges, indexed read-only source, workspace isolation and auto-created-table protections. Both migration copies have identical SHA256: `86662302d34f939c31c8ed847b8a375e106896ea2be78e4edf512bd20f5ad741`.

Windows Application Control blocked the psycopg DLL in the sandbox during initial collection. Tests were rerun outside that sandbox using local/mock targets; production was not accessed. Existing Starlette TestClient emits an anyio deprecation warning.

## 17. Provider / quality limitations

Requires API-Football access and enough final-score history in the current/previous-two-season collection. Rate limits/outages/missing teams or outcomes leave free unavailable. Newly promoted/new European participants can have sparse in-competition history. Champions League is trained only on its own history; domestic-strength priors, xG, player context and complete rest schedules are intentionally absent. This baseline has not received a production calibration/performance benchmark. Training from a historical archive without knowledge timing is deliberately unsupported.

## 18. Remaining activation work

No local implementation blocker remains after validation. Production use still requires separate authorization to review/apply the migration, release both repositories and run the opt-in worker prospectively with provider access. Evaluate baseline quality on genuine prospective outcomes before making performance claims. Correction/version lifecycle and persisted evaluation/comparison cohorts are follow-ups, not silent refresh features.

## 19–20. Safety confirmations

No commit, production deployment, production migration, Railway activation, Vercel source change, production data write, premium forecast recomputation or historical free backfill occurred. No historical FREE target forecasts were fabricated. Synthetic fixtures/results exist only in isolated tests; live generation admits future eligible fixtures only.

Premium model mathematics, Champion policy, Combined weights/source, Decision Intelligence, World State, calibration, shadow/research policies, settlement and entitlements/payment logic remain unchanged.

## Changed files

Engine checkout: `app/football/free_prematch.py`, `free_repository.py`, `free_worker.py`, `free_evaluation.py`; `app/domains/football/free_source.py`, additive routes in `router.py`; the two migration copies; `compose.free-staging.yaml`; `tests/test_free_prematch.py`, `test_free_postgres.py`.

Customer application: `lib/predictive-compass/server.ts`, `free-server.ts`, `free-server.test.ts`, new `free-core.test.ts`; `app/matches/dashboard.tsx`, `match-components.tsx`, `free-product.test.tsx`, `[matchId]/page.tsx`; `app/predictions.tsx` generalized date/sort helper types without behavioral changes; this report and the signal audit. Earlier uncommitted UI/free-contract work and unrelated user changes were preserved.
