# Early/basic signal audit for free_prematch_v1

Audit performed before wiring the independent model. Engine checkout: `.staging/main-customer-repairs`, based on verified main `f99be45410aed67725c3e92fbc2347cb291c60dc`. No production queries or changes were used for this audit.

| Candidate | Classification | Provenance and decision |
| --- | --- | --- |
| Competition, provider fixture ID, teams, home/away, kickoff | FREE ALLOWED | Explicit projection from API-Football's fixture endpoint. League ID must match the competition registry. Only scheduled NS fixtures are eligible. Observation time is recorded after receiving the response. |
| Regulation-time historical final scores | FREE ALLOWED | Same fixture endpoint, FT status and `score.fulltime`. Each result carries its actual observation timestamp. Exclude AET/PEN, missing scores and results less than 24 hours old. Training and current features are derived only from these projected results. |
| Historical team strength and stable priors/home advantage | FREE ALLOWED | Existing `model.py` `TeamState`, `_update`, `build_training_rows`, `_features`: Elo begins at 1500, home adjustment 65, Elo update factor 20, using final scores only. Rebuild from the filtered results, never load existing saved states. |
| Basic form / scoring-conceding tendency | FREE ALLOWED | Existing five-result points and goal-difference averages, derived from approved scores only. No current lineup/availability inputs. |
| Match-count context | FREE ALLOWED | Existing per-team count capped at 20, derived only from filtered results. |
| Season / current-season history | FREE ALLOWED | Provider season/range scopes collection across the current and previous two seasons. Season itself is not a model feature. Competition history remains separate. |
| Odds, implied probabilities, Market output/movement | PREMIUM ONLY | Excluded entirely; the free worker never calls odds endpoints. |
| Confirmed/expected lineup intelligence, injuries, availability, suspensions, player ratings/replacements | PREMIUM ONLY | Excluded entirely; no lineup, injury, player or composition endpoints are called. |
| Formations, tactical/manager updates, late news | PREMIUM ONLY | Excluded entirely from typed model inputs and feature allowlist. |
| World State, contradictions, evidence quality, revisions | PREMIUM ONLY | No World State or evidence compiler input; no GI integration or forecast revision call. |
| Champion, Unified, Combined, premium versions | PREMIUM ONLY | Existing final probabilities and team-state bundles are never used. Champion's post-processing is not bypassed by relabeling its output: a separate classifier is fitted from approved results. |
| Shadow, candidate policy, research outputs | PREMIUM ONLY | Never read as free inputs or alternate sources. |
| Live / halftime / in-play markets | PREMIUM ONLY | NS fixtures and FT result history only. No in-play probability path. |
| Existing historical fixture archives | UNSAFE / AMBIGUOUS | `FootballHistoricalFixtureRecord` has no reliable first-known/observed column for this policy. A historic kickoff date is not proof of knowledge at a proposed earlier cutoff. Excluded from free generation. |
| Existing saved model bundles/team states | UNSAFE / AMBIGUOUS | Cannot guarantee training cutoff, feature family and free-only input provenance. Excluded. |
| Existing xG / expected-goal features and published expected performance | UNSAFE / AMBIGUOUS | Their complete free-only provenance was not established. Excluded rather than adopting a final premium-derived estimate. |
| Fixture-only rest | UNSAFE / AMBIGUOUS for v1 | Potentially safe with a complete schedule, but incomplete competition history may omit domestic/cup fixtures. Not implemented. |
| Basic public explanations or form text | UNSAFE / AMBIGUOUS for v1 | No independently restricted text generator exists. Do not copy premium summary/factors into the free contract. |

The allowlist is a fixed tuple of nine named features in `free_prematch.py`. It does not automatically expand if premium `FEATURE_COLUMNS` changes. Existing feature/training-row output must match that tuple exactly or generation fails. The typed fixture/result models reject unknown fields; provider projection explicitly selects allowed fields from mixed raw records.

The forecast is strictly prospective. Historical results may train the current early forecast, but no historical target forecast is generated. This distinction is essential: observing an old match result today does not authorize claiming that a free forecast existed before that historical match.
