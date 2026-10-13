# Automatic customer lifecycle and marketing performance release

## Scope and preserved rules
Customer App only. No Core API, forecast calculation, eligibility, historical classification, commerce, pricing, payment or secret changes. Canonical completed-fixture inventory remains the master. Free, historical and official Premium retain independent denominators. Page, PDF and social image use the same authorized WeekendReport projection. Protected snapshots are never included for anonymous/unpaid readers.

## Problems addressed
Owned PREPARING pages had no preparation refresh. Live polling did not switch FINAL into the completed server report. My Predictions could remain stale or show an empty list after a source failure. Performance hid the weekend report behind a small link. Date controls preceded report results. Report reads cached settlements for five minutes.

## Refresh and recovery
Visible owned pages refresh at 5 minutes more than an hour before kickoff, 2 minutes at T-60 to T-15, and 30 seconds inside T-15. READY reduces preparation polling; a kickoff check and subsequent 60-second checks continue lifecycle discovery. These times control request frequency only, never readiness. Hidden tabs suspend automatic refresh. Router transitions prevent overlapping route refreshes. Existing live polling detects Core FINAL and refreshes the historical report. My Predictions refreshes every minute with active matches and every five minutes otherwise; reads are bounded to four concurrent match requests.

Only previously authorized rendered content is retained during a transient refresh failure. Explicit hidden readiness and loss of access clear retained content. Missing readiness remains fail-closed on an initial load. Owner access bypasses payment only. Historical owned premium_prematch continues using its independent authorized historical path. Post-kickoff unavailable release messaging does not fabricate a preparation failure or unlock a forecast.

Lifecycle reads remain no-store. Weekend service-data revalidation is shortened to 60 seconds; entitlement decisions and exports remain private, uncached customer responses. Next stale-while-revalidate may require a subsequent refresh to display newly fetched report data. Read-only recovery retries transient transport errors and 5xx once. Authorization, malformed contracts and invalid identifiers are not retried. Freshness POST and payment mutations are not retried. Sanitized diagnostics contain category, timestamp, match identifier and lifecycle where known, never user data or credentials.

## Performance presentation
Performance defaults to the complete latest weekend. Prominent Weekend / Official navigation preserves the strict official area and period deep links. A navy/blue hero shows the actual, explicitly labelled Free record before date filters. All completed fixtures remain represented. Category metrics, access scope and methodology stay separate. Full report, PDF and 1080x1350 social image are directly accessible, with a visual preview and upcoming-matches CTA. PDF and social use the same truthful labelled headline.

## External dependency
During local production-source checks on 2026-10-13, the Core completed-fixtures endpoint failed to return within 65 seconds. Customer rendered a safe unavailable state and returned 503 for exports rather than publishing incomplete figures. Genuine captured production responses are used for deterministic layout validation; they are not fabricated records or production availability proof. Existing Core connection investigation remains a separate, undeployed PR. No Core operational changes are part of this release.

An authenticated production browser session is unavailable. Owned visual acceptance remains MANUAL POST-DEPLOY VERIFICATION REQUIRED; automated access, readiness, historical and transition tests cover the protected paths. Zero manual intervention cannot be claimed while upstream report inventory is unavailable.
## Validation
626 tests passed across 56 files, followed by 37 affected-route/transport checks and a genuine authorized export capture. TypeScript, lint and production build passed. Captured-response production-build checks returned 200 for Performance, full weekend report, PDF and social image, preserving all ten fixtures and withholding protected data from anonymous visitors. Anonymous PDF (3 pages), authorized PDF (4 pages) and 1080x1350 social image were rendered and visually inspected. 320/375/1280 layout checks found no horizontal overflow and placed headline metrics above date controls, within the first viewport. Production-source availability is reported separately from this deterministic visual validation.
