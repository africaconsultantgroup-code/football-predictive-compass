# Historical match reports

Source: Core `GET /api/v1/domains/football/matches/{match_id}/prediction`, serialized by `FootballMatchPrediction` and `FootballHistoricalPremiumIntelligence` in the production Core contract inspected on 12 October 2026.

The response includes match identity, competition, nullable kickoff, status, nullable minute/added time/current score, stage, current prediction, nullable `premium_prematch`, `history`, and nullable updated timestamp. `FINAL` plus a verified current score supplies the result; the current prediction never substitutes for frozen pre-match Premium or immutable Free.

## Frozen Premium contract

All fields are serialized, including nulls and empty arrays:

- `access_status`: `LOCKED_PRE_KICKOFF` or `LEGACY_PREMATCH`.
- `label`: `Frozen Pre-Match Intelligence` or `Legacy Pre-Match Intelligence`.
- `official_performance_eligible`: boolean supplied by Core.
- Nullable `probabilities`: home_win/draw/away_win percentages.
- Nullable `compass_pick`: market `Match Result`, selection, model_probability, strength, nullable generated_at.
- Nullable `recommendation_strength`: label and nullable score.
- Nullable `score_forecast`: available/unavailable status, nullable most_likely_score, nullable score_probability, alternative_scorelines array.
- `bookmaker_comparison`: selection, bookmaker_implied_probability, bookmaker_consensus_fair_odds, compass_probability, compass_fair_odds, probability_difference.
- `intelligence_reasons`: category and summary; at most five.
- Nullable `generated_at` and `evidence_cutoff_at`: ISO timestamps with timezone.

Strength values are Strong, Moderate, Cautious, Unavailable. Score coordinates are nonnegative integers. Probabilities are 0–100. There is no historical forecast-change field; it displays unavailable.

History entries contain stage, nullable minute/current score, predicted_outcome, nullable predicted_score, probabilities, reliability, nullable generated_at, change_reason and change_description. Only stored entries render, never invented stages.

Customer-safe classification and timestamps may display. No workspace/provider/snapshot IDs, raw evidence, model internals or policy/shadow data enter the report. Unknown frozen Premium fields fail parsing.

## Access and evaluation

Existing server-side ownership and owner/full-access checks authorize historical Premium. Current upcoming readiness does not revoke a completed frozen snapshot. Upcoming readiness remains unchanged. Unpaid HTML/PDF projections exclude Premium and paid timeline snapshots.

Free comes only from the dedicated immutable Free endpoint. Correctness compares the stored pick/score to the verified result; it never recalculates a forecast. Unrecognized selections display NOT APPLICABLE. No invented score strength is reported.

The match page and authenticated report route render the same report as the authenticated PDF endpoint. Live API responses omit the newly added historical fields to preserve separate stage authorization.

## Weekend inventory dependency

Per the user's correction, a complete Weekend Prediction Record is pending a canonical customer-safe Core completed-fixtures list. Commerce tables, entitlements, My Predictions, Premium-only lists and `/performance/official` are not a complete fixture inventory and must not be used to construct it. No weekend page, PDF or social asset is fabricated from these sources. `/performance` remains unchanged and official-only.

## Verification

Production Core Arsenal–Leeds: HTTP 200, FINAL 2–1, legacy Arsenal to win 55.95%, frozen 2–0 forecast. Aston Villa–Brentford: HTTP 200, FINAL 2–2, legacy Villa to win 52.86%, frozen 2–1 forecast. Both retain recorded history. Test fixtures are captured customer-safe production DTOs, not generated production records.

Authenticated production visual/PDF verification requires the user's existing session; no passwords, tokens or synthetic sessions are requested or created.
