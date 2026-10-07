# Customer Free/Premium checkpoint — 7 October 2026

This checkpoint contains the white/blue matches redesign, independent stored Free source contracts and customer detail, protected Premium DTO/experience and their tests. The paired engine branch contains independent opt-in `free_prematch_v1`, immutable storage/migrations, worker, read routes and tests. They are separate Git repositories and therefore require two coordinated commits, not one commit containing both repositories.

Reviewed customer paths: 34 files / 2,141 lines before this note. Engine paths: 11 files / 951 lines. Explicit staged-file review and credential-pattern scan found no environment files, credentials, generated images, databases, model artifacts or disposable UI fixtures. Synthetic data remains confined to tests; disabled product-preview prices are explicitly marked preview-only and never sent to checkout.

Unrelated prior local changes are excluded: Paystack implementation/test changes, staging scripts and infrastructure, root globals/source-scanning adjustment, Next/package/TypeScript/ESLint configuration, workspace file, prior production evidence and output artifacts. Authentication, entitlement, payment processing and production deployment configuration are unchanged by this checkpoint. Checkout changes only allow a display label.

Clean customer checkpoint: 270 tests across 22 files passed; TypeScript and lint passed. The earlier 279 count included one excluded Paystack staging test and eight excluded staging-harness tests. A Windows checkout converted an existing SQL file to CRLF; its LF content was restored locally for the unchanged newline-sensitive assertion. Initial Turbopack junction and sandbox font-download failures were environmental and resolved through independent locked dependency installation and permitted font fetch, without changing source or tests.

Production build passed with the existing isolated staging configuration supplied in memory to the clean checkout. The build requires Supabase configuration for the existing static pricing page; no environment file or credential was copied into the checkout. No source or production configuration was changed to make the build pass.

Focused engine validation: 74 passed, 1 skipped. The skip requires explicit read-only production regression opt-in; this task does not enable it. Existing Starlette deprecation and pytest-cache warnings remain.

Vercel customer production branch: main. Railway active production source: main, commit f99be45410aed67725c3e92fbc2347cb291c60dc, unchanged learning-worker command. Safe remote checkpoint branch in both repositories: customer-free-premium-v1. No main push or intentional production deployment is authorized. Preview builds may be triggered by the Git integration and must be reported separately from production.

The accompanying implementation reports record earlier local phases; statements that those phases were uncommitted refer to their validation dates. This checkpoint does not establish readiness for production activation. Genuine prospective provider capture, immutable-row rechecks and actual Paystack TEST purchase/entitlement acceptance still need the isolated staging report.
