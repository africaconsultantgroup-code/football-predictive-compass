# Core contract follow-up: customer-safe team identity

Separate future Core task; no ML Engine changes are included in this Customer App repair.

Expose `home_team_id`, `away_team_id`, `home_team_crest` and `away_team_crest` from existing provider metadata on upcoming Free/Premium, prediction detail and match prediction responses. Include an explicit provider namespace for IDs, or expose qualified football-data.org/API-Football IDs. Their numeric ID spaces must never be confused.

Preserve football-data.org v4 `team.id`, `name`, `shortName`, `tla` and `crest` during provider normalization. Reuse stored metadata rather than adding provider requests to inventory reads. Return only public identity metadata, independently of paid intelligence. Missing identity metadata must never prevent forecasts from loading.

The Customer App now accepts safe crest metadata and qualified IDs, preferring a supplied football-data.org crest over API-Football and its controlled registry. Until this contract exists, the reviewed Customer App registry supplies known identities without provider credentials.
