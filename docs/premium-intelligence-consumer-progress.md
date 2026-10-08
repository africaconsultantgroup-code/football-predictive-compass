# Premium intelligence consumer — 8 October 2026

Status: **layout improvements validated; approved backend contract required to complete populated intelligence UI.** Work in this task is confined to the customer repository. No ML Engine files were inspected or modified, and no deployment or commit was performed.

> Historical checkpoint, superseded by [the finalized contract integration report](premium-intelligence-integration-report.md). The approved backend contract has now been integrated and local validation passes.

## Requested results

1. Files changed: `app/matches/premium-components.tsx`, `app/matches/premium.css`, `app/matches/premium.test.tsx`, and this report. Pre-existing unrelated changes are preserved.
2. New reusable components: `BookmakerComparisonCard`, `RecommendationStrength`, currently explicit compact unavailable states. Existing primary/pick/opportunity/comparison/reason/score/freshness components are retained.
3. Premium fields consumed: existing approved fixture identity, H/D/A percentages, predicted outcome, original generated time and existing refresh-in-progress signal. No new intelligence transport fields are invented or admitted.
4. Compass Pick: compact unavailable state. Populated market/selection/probability/risk/Preferred fields cannot be connected without their approved schema.
5. Bookmaker comparison: new unavailable card. Odds, implied/model probabilities, fair odds and backend-supplied difference need the contract; nothing is calculated from odds in React.
6. Ranked markets: existing unavailable state. No ranking, selection or derived probabilities are fabricated. Rendering backend ranks remains pending.
7. Reasons: honest unavailable state retained; no unsupported team/news/provider facts are inferred.
8. Strength: explicit unavailable state; no fake confidence or unapproved mapping.
9. Correct score: existing disabled state; no score or alternatives inferred.
10. Free/Premium comparison: original safe fixture/timestamp checks, independent percentage-point changes and leader-change rendering preserved. Desktop placement follows opportunities; mobile placement follows reasons.
11. Mobile: CSS stacks cards, orders primary/pick/bookmaker/opportunities first, then reasons and comparison. Desktop follows the requested semantic order. This task has no new browser visual verification; actual populated mobile cards remain pending the backend contract.
12. Checkout/entitlement: no payment/access code changed. Entitled view remains free of purchase CTA; locked view retains Free and real backend offer pricing. Existing denial-before-load/paid-state/server-page checks pass. No GHS25 or Matchday Pass activation.
13. Validation: **279 customer tests passed across 23 files**, TypeScript passed, lint passed, production build passed. Customer test discovery explicitly excludes the nested checkpoint copy to avoid double-counting. Existing order assertions updated for the new requested desktop sequence; all existing privacy, access, comparison and checkout tests retained.
14. Still unavailable: approved pick, bookmaker comparison, opportunity, reason, strength, score and lifecycle schemas/values, including their unavailable representation, units, ranking semantics and endpoint location. No such schema/example/document exists in the searched customer `app`, `lib` or `docs` paths. Current `premium.ts` intentionally returns empty/null optional intelligence, and the existing FootballPrediction parser strips unknown input fields. Merely adding JSX would not make the backend data safely reachable.

## Required integration input

Provide the approved customer-safe schema (or representative available and unavailable payloads), endpoint and authentication requirements. Units must distinguish 0–1 from percentage values; ranking order and enum/presentation mappings must be explicit. This is a missing integration dependency, not a request to alter model logic.

After that is supplied, implement the server-side whitelist projection and loader, wire populated reusable cards, add populated/partial/malformed/privacy/ranking tests and perform desktop/mobile visual verification. Unsupported fields remain excluded until then. Existing endpoint protection is unchanged.
