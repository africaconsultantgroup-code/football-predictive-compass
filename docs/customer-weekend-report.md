# Complete weekend prediction report

## Source contract

Server-only `GET /api/v1/domains/football/matches/completed?from=YYYY-MM-DD&to=YYYY-MM-DD` is the master list. Dates are inclusive; Core permits 1–31 days. Envelope: `{from: date, to: date, matches: FootballCompletedFixture[]}`.

Every serialized fixture field is required by the Customer parser:

- `match_id`: Core `fm_` identifier; `competition`, `home_team`, `away_team`: strings.
- `kickoff_at`: ISO timestamp; `status`: `FINAL`; `final_score`: nonnegative integer `{home, away}`.
- `home_team_identity`, `away_team_identity`: currently null placeholders.
- `free_prematch_available`, `premium_prematch_available`, `live_history_available`: booleans.
- `premium_classification`: `OFFICIAL_PREMATCH | LEGACY_PREMATCH | null`.

Unknown fields and duplicate fixture IDs fail parsing. Core's fixture classification never substitutes for official-report membership. The official source remains `/performance/official`, using the existing strict schema. Matching uses canonical team registry names, competition and the kickoff instant; the immutable Free source also must match the fixture ID. Aliases in stored Free snapshots are preserved and resolved through the existing canonical registry.

## Presentation and security

`/performance/weekend` defaults to the latest Saturday–Monday weekend represented in the last 31 days of completed inventory. An inclusive custom range is supported. Missing forecasts retain their fixture and final result. Free comes only from the dedicated immutable Free endpoint. Historical Premium comes only from completed `premium_prematch`, never current FINAL probabilities or live snapshots. Historical and official accuracy denominators remain separate; official correctness comes from Core's settlement.

The page and both export routes share `loadWeekendReport`, the same date validation, per-match server-side access checks and projection. Public visitors receive every fixture and genuine Free results. Protected Premium picks and probabilities require existing match/full access, including the server-verified owner role. Restricted reports clearly state their Premium scope. An anonymous report must never be represented as an account's complete Premium performance report.

The historical detail link retains the existing authorized lifecycle/timeline UI. Completed historical Premium does not use current readiness gating. Upcoming readiness, pricing, payments and entitlements are unchanged.

PDF and social downloads are private/no-store. Source failures retain page rows with a clear unavailable state, but withhold downloads with HTTP 503 until the complete accessible data is available. Social PNGs are 1080×1350, ten fixtures per image; larger selected ranges expose every numbered download. Exports contain no Core credentials, evidence payloads or paid details beyond the authenticated account's access. Core reads are bounded, with two fixture workers and 20-second request deadlines.

Production verification measured an initial complete page at 24.4 seconds, a successful PDF at 15.6 seconds and a successful social PNG at 22.8 seconds, with intermittent master-inventory reads failing in between. The report's football-data fetches therefore use Next's server Data Cache with a five-minute revalidation period. Its key includes URL and headers; only HTTP 200 responses are cached. Authorization and customer projections are never cached. A previously fetched Premium snapshot cannot bypass a subsequent user's access check. This cache is limited to the new weekend report and does not change the pending Matches performance proposal.

## Verified transition weekend: 10–12 October 2026

- Authenticated Core inventory: HTTP 200, ten unique FINAL fixtures. Missing credentials: HTTP 401.
- Ten immutable Free forecasts: four correct, 40%.
- Five historical Premium forecasts: three correct, 60%.
- Five available Premium score forecasts: zero exact-score hits.
- Official source: HTTP 200, zero records. Display: “No qualifying T-30 READY settlements yet”.
- Captured production DTO acceptance: all ten fixtures retained; aliases resolved without inventing forecasts.
- PDF: four rendered A4 pages; all ten teams/results verified by extracted text and visual inspection.
- Social: real PNG, 1080×1350; all ten fixture results visible.
- Browser layout: 320, 375 and 1280 pixels, ten cards and both downloads; no horizontal overflow.

No authenticated production browser session is available. The account-specific Premium page/PDF/social visual check remains **MANUAL POST-DEPLOY VERIFICATION REQUIRED**; production Core reads and automated entitlement/projection tests verify the available server path. No sessions were minted, secrets changed or payments performed.

The unreviewed `/matches` performance proposal remains isolated on its existing local branch and is excluded from this release.
