# Matches performance investigation — review required

Date: 13 October 2026 (Ghana time). Production baseline: PR #17, main `37d9f2b7247422a8f21f94353dd6a9f7305cd0a5`. Local proposal: `perf/customer-matches-loading`. No commit, push, deployment, migration, secret change, payment or Core/ML change was made for this investigation.

## Production measurements

Anonymous real production requests, sequential reads, no forced infrastructure restart. TTFB includes client/edge/network time; completion is the full streamed response, not server CPU time. Fixture markup and browser-visible fixture times are measured separately.

| Matches request | First response byte | Full response | First fixture markup | Outcome |
|---|---:|---:|---:|---|
| First observed | 0.376 s | 18.509 s | 18.251 s | 23 fixtures |
| Repeat 1 | 0.359 s | 40.586 s | 40.376 s | 23 fixtures |
| Repeat 2 | 0.388 s | 40.446 s | Not delivered | Service unavailable |

Home's first-byte times were 0.773 / 0.404 / 0.426 seconds, while its full streamed responses took 11.272 / 9.973 / 40.466 seconds. Its static hero/shell can appear promptly while forecast content remains pending; a fast first byte does not mean inventory is ready.

Actual isolated Edge browser measurements, fresh context versus repeat navigation:

| Viewport | Browser cache state | TTFB | Shell available | Fixtures visible |
|---|---|---:|---:|---:|
| 375px | Cold browser | 0.266 s | 0.837 s | 15.673 s |
| 375px | Warm browser | 0.130 s | 0.509 s | 10.896 s |
| 1280px | Cold browser | 0.255 s | 0.715 s | 10.467 s |
| 1280px | Warm browser | 0.083 s | 0.741 s | 10.553 s |

All had 23 rendered fixtures and no horizontal page overflow. Browser cold means a new browser context with HTTP cache disabled. It does **not** prove a cold Vercel function or database; infrastructure cold starts were not forced. Repeated production requests were sometimes slower, so cold start alone cannot explain the complaint.

Direct production Core requests in the same investigation:

| Endpoint | First observed | Repeat 1 | Repeat 2 |
|---|---:|---:|---:|
| Free upcoming | 61.336 s / 503 | 64.927 s / 200 | 3.544 s / 200 |
| Premium upcoming | 61.338 s / 500 | 29.358 s / 500 | 17.036 s / 200 |

## Confirmed cause

Production Core runtime logs contained 23 pool-checkout failures in the sampled one-hour window. The exact error was:

`(ECHECKOUTTIMEOUT) unable to check out connection from the pool after 60000ms in Transaction mode`

The traceback includes the upcoming inventory route and stalls while executing `SET LOCAL statement_timeout`, before the forecast query can run. A SQL statement timeout and TCP connect timeout do not protect a request already waiting for a transaction-pool backend. This matches the approximately 61-second direct API failures.

Customer then amplifies the visible delay: both inventories run in parallel, but `Promise.all` prevents either from rendering until both finish. Each can make two 20-second attempts. One healthy source therefore waits behind a sibling outage for about 40 seconds; both failures produce no fixture inventory. This explains intermittent smoke-test completion timeouts despite HTTP 200 headers arriving quickly.

Read-only Core database snapshots showed a small number of client backends, including an active Supavisor transaction lasting about 18 seconds and an idle transaction in another sample. These snapshots do not establish global Postgres connection exhaustion or identify the responsible producer. Supavisor's limit is per database/user/mode, not simply the global backend count. See [Supabase's pool-size explanation](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI).

A read-only `pg_stat_statements` snapshot found six completed Premium inventory queries averaging 1,823.25 ms, maximum 3,746.49 ms. These are individual successful SQL executions, not entire API requests or pool waits; the statistics reset window is unknown. They support distinguishing query execution from the separately confirmed 60-second checkout failure, without attributing all pool contention to this query or to a worker.

**Attribution:** Core inventory retrieval and its Supabase transaction pool are confirmed contributors. Customer's join/retry/sequential enrichment amplify them. Railway is not called by the Customer render or these stored-inventory reads. Background Railway workloads could contribute to pool contention, but no evidence here identifies one as the culprit. No Railway or pool configuration was changed.

## Complete render dependency trace

1. Proxy runs Supabase `getClaims`; page runs request-memoized `getCurrentUser` and awaits query parameters. With no authenticated session, no user entitlement tables are needed. Production TTFB is already sub-second.
2. Premium Core `predictions/upcoming` and Free Core `free/upcoming` run in parallel. Both are server-only, `no-store`, with API keys in headers. The browser never receives or calls the Core key.
3. Premium loader then gets Customer access: active `admin_users` owner lookup; for normal customers, `subscriptions` joined to plan entitlements.
4. Per Premium fixture: existing `hasPredictionAccess`; owner/full-access capability shortcut, otherwise permanent `customer_match_entitlements`, then legacy active/non-expired `prediction_access_grants` if necessary.
5. Original dashboard waits for both inventories, then repeats the Customer access lookup. It reads pending basket and legacy checkout rows in parallel from `match_basket_payments` with immutable quotes and `prediction_payments` with product memberships.
6. Per Free-only fixture, the same permanent/legacy access checks run. All existing checks and their fail-closed behavior remain authoritative.
7. Fixture rows, basket choices, pending recovery controls and date/competition groups render. Crest identity resolution reads a local reviewed registry; remote images are lazy and never determine whether a fixture renders. No provider calls, inference, Paystack initialization or payment verification occurs while loading Matches.

For N Premium and F Free-only fixtures, normal signed-in customers can incur up to `6 + 2(N+F)` Customer table reads before the original full view completes; actual counts depend on ownership and capability shortcuts. This is a code-path upper bound, **not** an authenticated production measurement. No session was available, and none was fabricated. The proposal removes the duplicate access lookup and overlaps pending-checkout reads; it preserves the per-match authorization predicates rather than rewriting entitlement rules.

The inspected Core implementation separately reads both supported competition workspaces sequentially. Free uses an immutable-snapshot read with a five-second SQL timeout; Premium reads latest pre-match versions with a 25-second SQL timeout and customer-safe projection. Each workspace opens its own pooler connection. None of these routes awaits a Railway learning worker or provider fetch. Core pool checkout can block before these SQL timeouts are installed.

## Local proposal implemented for review

- Stream the first nonempty genuine fixture inventory instead of waiting for the slowest source. Empty/failed sources cannot erase a healthy one.
- For Premium-first delivery, project public fixture identity only. Never present Premium probabilities as Free or send paid content before authorization.
- Show a compact loading status while the complete, already-authorized dashboard resolves. Early rows offer safe detail links, not purchase actions before access/pending checks finish.
- Start one request-scoped access context and pending-checkout reads beside inventory, rather than repeating them afterward. No cross-customer or cross-request authorization cache is added.
- Use one bounded 20-second request per inventory source on `/matches`. This avoids starting another database-pool wait during a known outage. Manual Retry fixtures remains. Other pages, checkout readers and historical readers keep their existing transport policies.
- Keep the existing combined row join, exact Free/Premium identity check, readiness rules, ownership decisions, basket pricing and pending-checkout handling for the completed view.

## Controlled before/after measurements

Same machine, same production Next build mode, same 23 captured customer-safe Free fixtures, same replay delays (Free 3.54 seconds, Premium 17.03 seconds). The Premium replay returns an empty valid inventory to isolate the latency join; no production Premium record is fabricated. No external provider or production database is used by this replay. First mobile request follows a fresh local server start; subsequent requests are warm. Desktop cold refers to browser cache only.

| Case | Before: first visible fixture | Local proposal: first visible fixture |
|---|---:|---:|
| 375px, cold process/browser | 17.905 s | 4.235 s |
| 375px, warm | 17.267 s | 3.757 s |
| 1280px, cold browser / warm process | 17.321 s | 3.777 s |
| 1280px, warm | 17.245 s | 3.700 s |

This is about 76–79% earlier fixture visibility under the controlled workload. It is not a post-deploy production result. A separate local HTTP probe saw fixture markup at 3.741 seconds and full response completion at 17.196 seconds: streaming improves usability without pretending the slow service became faster.

The outage replay delays Premium for 60 seconds while keeping genuine Free fixtures at 3.54 seconds. The Customer request makes one attempt and ends at its unchanged 20-second deadline:

| Viewport | First visible fixture | Final response complete | Final visible fixtures | Retry control | Horizontal overflow |
|---|---:|---:|---:|---|---|
| 320px | 4.296 s | 20.310 s | 23 | Visible | None |
| 375px | 3.906 s | 20.143 s | 23 | Visible | None |
| 1280px | 3.804 s | 20.090 s | 23 | Visible | None |

The complete degraded view replaces the temporary view without losing or duplicating visible fixtures. Its recovery banner is compact, rather than a large empty status panel above the fixture list. Both source-failure and no-available-record states are covered by tests; no missing fixture facts are invented.

Validation: **581 tests across 52 files passed**, TypeScript passed, lint passed, production build passed. The build was local only. Existing readiness, historical report, ownership, purchase and payment regression tests remain green.

## Review boundaries and remaining work

- **Not deployed.** Review these findings, the local diff and the retry tradeoff before any production release.
- Core needs an operational investigation of per-role transaction-pool capacity, transaction lifetimes, concurrent producers and query cost. Do not simply lengthen Customer timeouts or blindly raise pool limits. No pool, database, worker, secret or prediction logic was modified here.
- If **both** prediction-backed inventories fail on a cold instance, Customer has no independent fixture truth to display. Complete outage resilience needs an independent customer-safe fixture metadata feed or a bounded public schedule cache with clear freshness rules. This proposal handles a slow/failed sibling service; it does not invent fixtures or reuse old paid snapshots.
- Authenticated production latency and ownership-state visual checks remain unmeasured because no session was exposed. Automated authorization and payment regressions remain part of validation.

Raw sanitized timings, failure summaries and validation totals are in the adjacent performance evidence JSON. Captured DTOs and temporary browser artifacts remain ignored locally; no credentials or private payloads are included in the report.
