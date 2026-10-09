# Customer experience release validation

The customer repair unifies the white/blue experience, removes Live/Halftime from primary navigation, and keeps supported stage intelligence on the owned match page. One Premium Match Intelligence purchase remains the product; Pricing V2 and payment configuration are unchanged.

Inventory transport now allows bounded read retries and a 20-second upcoming read deadline. Fixture metadata and Free inventory survive independent access/Premium failures. My Predictions resolves readable identity using current, upcoming, history and immutable quote metadata. Team identity has safe crest/initials fallbacks.

Clean release validation: 424 tests across 37 files; 11 local HTTP checks; TypeScript, full lint and optimized production build passed. Fresh read-only Core capture: Free HTTP 200 with 19 fixtures; Premium HTTP 200 with 10 forecasts. No prediction mathematics, forecasts, database migrations, credentials or payment behavior changed.

Mobile features included: compact header, bottom navigation, competition chips, date selector, mobile cards, My Predictions and Account layouts. The separate complete mobile redesign is not yet included: a sticky basket bar remains future work. Basket controls currently use normal scrolling.

## Approved mobile production release, 9 October 2026

Remote main already contains the approved implementation through PR #3
(`1188fce`) and the populated mobile overflow correction through PR #4
(`f850ecf`, merge `a40681147d52923cf139244c56d2f96ca4cf3166`). All 46 approved
customer source, test and HTTP-check files match the reviewed workspace exactly.
The release continuation adds test-discovery exclusions and artifact upload
exclusions, preserving the approved application behavior and dependency lockfile.

Final isolated release checks: **424 tests in 37 files**, **11 HTTP checks**,
TypeScript, full lint and optimized production build passed. The workspace's
425th test belongs to an unrelated staging-only Paystack change and is excluded
along with that change. No assertions were removed from the release suite.

Fresh stored Core GETs: Free HTTP 200, 19 fixtures, 10,908 ms; Premium HTTP 200,
10 forecasts, 15,907 ms. Both feeds pass the current strict customer schemas and
the actual-data card adapter test. Neither feed supplies crest/logo fields.
Styled initials remain available without blocking fixtures; supplied safe HTTPS
crests and image-error fallback remain supported without additional provider calls.

Pre-release public production checks pass: 19 match cards, Free probabilities,
Premium Match Intelligence, GH₵8, basket, compact-header markup and four mobile
navigation destinations. Account and My Predictions require authentication;
anonymous Premium returns HTTP 401. No obsolete GH₵10/GH₵25 offers or raw
internal-ID headings were found on checked public pages.

Browser automation and an authenticated browser session are unavailable in this
continuation. Authenticated mobile visual checks of My Predictions, Account and
one owned match are manual post-deploy verification, not release blockers. The
accepted populated 320px/375px and desktop visual evidence remains the baseline;
this continuation does not claim a fresh browser measurement. Recovery, identity
fallback and owned lifecycle behavior remain covered by passing regressions.

No ML Engine changes, migrations, environment changes, forecast writes, checkout
initialization or payment transaction are part of this release. Production uses
the existing Vercel project configuration. Commit, PR, merge and deployment IDs
are reported after the release actions complete.
