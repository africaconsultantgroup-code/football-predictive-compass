# Customer team crests

The customer Core feeds currently expose names without provider team IDs or crest URLs. Customer normalization previously stripped additional display metadata; optional identity metadata now survives normalization, preview projection and immutable quote metadata.

`lib/teams/identity.ts` is the shared resolver. It prefers supplied football-data.org crests, qualified API-Football IDs, then cached canonical identity. `data/team-identities.json` is a reviewed durable server-side registry; components contain no team mappings. The customer shell supplies the cached snapshot to Matches, My Predictions, detail/owned intelligence and basket summaries.

Registry IDs were checked against the actual club images on the official API-Sports team media CDN, including Lens 116 and Viking 759. No provider keys, scraped images or name-derived numeric IDs are used. Sabah FA remains unresolved rather than guessing an ID.

The original 19-fixture snapshot has 18 fixtures with both crests and one with a single crest: 35 of 36 unique teams have verified API-Football crests, zero have football-data.org metadata available and Sabah FA uses initials.

The fresh 2026-10-10 Core read returned 28 Free fixtures and 10 Premium forecasts. After reviewing additional provider images, 25 fixtures have both crests and three have one crest. Of 51 unique teams, 48 have verified API-Football crests and three retain initials: Sabah FA, Lask Linz and AEK Athens FC. Candidate images for the latter two identified different clubs and were excluded. No ID was published without visual provider identity confirmation.

Fixture resolution performs no provider, database or image requests. Images load lazily in fixed-size slots; errors advance to the next safe source and then styled initials. Forecast delivery does not await image loading. No measured network-performance improvement is claimed.

To audit a captured Core response, run `node scripts/audit-team-identities.mjs <inventory.json>`. Add `--verify-media` for read-only checks of all registered CDN images. Update aliases/IDs only in the registry after provider identity verification; review and release those changes normally. No runtime per-team searches are introduced.

The separate future Core contract task is documented in `core-team-identity-contract-follow-up.md`. Release validation passed: 474 tests, TypeScript, lint and production build. Production release was authorized on 2026-10-10.
