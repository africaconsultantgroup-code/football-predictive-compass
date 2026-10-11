# Official Premium performance

Both `/performance` and `/api/reports/performance/pdf` use the same server-only loader and projection. The only source is `GET /api/v1/domains/football/performance/official?from=YYYY-MM-DD&to=YYYY-MM-DD`. Core credentials stay in a server-side header. Responses are not cached.

Core exclusively owns snapshot eligibility. Customer does not recreate readiness, evidence timing, freeze or source-selection logic. It strictly validates the official contract and uses Core's settlement correctness booleans without recalculating results.

The exact response envelope is `{ domain: "football", metric_source: "official_premium_prematch", records: [...] }`. Each record contains competition/code, home/away teams, nullable kickoff, Compass Pick, H/D/A probabilities, recommendation strength, score forecast, nullable exact-score probability, bookmaker comparison and reason arrays, nullable generation/evidence timestamps, READY provenance, release timestamp, FROZEN_PREMATCH status and nullable settlement. Nested fields mirror Core's Premium contracts. Settlement contains actual home/away scores and outcome, Compass Pick correctness, nullable predicted score, actual score, exact-score correctness, settlement timestamp and regulation_time=true. All serialized keys are required; unknown keys fail strict parsing.

Source definitions were inspected read-only in Core's `official_premium.py`, football `router.py`/`contracts.py`, and `test_official_premium_snapshot.py`. Core's repository currently can return an official snapshot with settlement=null. Those are not settled performance results and do not enter result cards or settled metrics. There is no alternative forecast source or legacy-row fallback.

Periods use inclusive Ghana/UTC kickoff dates. Today is the current calendar day; 7/30 days include today; Season begins 1 July. Both output formats use the identical window and projected settled records. Only customer-facing match, pick and result fields leave the loader. Internal IDs, raw evidence, policy/shadow/model data are absent. Unexpected legacy/non-READY or unknown-field records make the report unavailable rather than entering a denominator.

Both accuracy denominators are the settled official match count; empty denominators display Unavailable rather than a misleading percentage. Correct counts are from Core's booleans. No marketing accuracy is hard-coded. Zero eligible settled records show the requested honest empty state and can still download a branded zero-record PDF.

Validation includes empty/correct/incorrect/mixed records, exact-score outcomes, null settlement, date boundaries/timezones, malformed/legacy payloads, transport failures, shared PDF source, actual PDF generation and responsive populated cards. Test examples are explicitly illustrative and never loaded in production. The live official endpoint initially returned records=[]; no production record was fabricated.
