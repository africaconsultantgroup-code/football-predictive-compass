# Stale Pricing V2 checkout recovery

The production GH₵8 payment was reconciled using its stored provider reference
through the existing production Paystack callback and approved basket
verification/finalization flow. It changed from pending to **failed**, with
`paid_at = null`, **zero reservations** and **zero entitlements**. In the deployed
verifier, failed is the direct mapping of Paystack's failed transaction status
after reference, amount, currency and metadata validation. No charge was
initialized and no status or entitlement was manually written.

The quote had expired. Paystack's gateway response and checkout-session expiry
timestamp are not exposed by the existing callback; no usable local live
Paystack credential is configured. Therefore the exact underlying gateway
failure reason and whether Paystack itself expired the session are **unknown**.
The confirmed failure explains why reusing this transaction was inappropriate;
quote expiry alone does not establish a provider failure.

Recovery changes:

- Existing quotes are verified against Paystack before a stored URL is resumed.
- Read-only pending discovery never exposes an unverified URL. The authenticated
  quote POST reconciles overlapping basket payments through the existing verifier.
- Continue Payment requires pending/ongoing provider status, payment-integrity
  checks, a pending stored payment, a safe Paystack URL and a quote still within
  its validity period. Client links expire after at most 60 seconds and require
  another verification. Provider verification requests time out after 15 seconds.
- Failed, abandoned, reversed and provider-expired payments use the existing
  atomic finalizer. Provider expiry maps to the existing failed database state;
  no migration is needed. Reservations are released only on confirmed terminal
  outcomes or approved success. Start Secure Checkout Again fetches a fresh
  immutable quote; confirmation initializes a new reference via Pricing V2.
- Stale but unresolved pending payments keep their reservation, hide the old
  link and offer verification. They require provider/operational reconciliation,
  rather than an unsafe age-based release and duplicate charge.
- Successful verification never rejects a payment solely because its quote
  expired. Existing reference/amount/currency/metadata/fixture checks and atomic
  entitlement/idempotency rules remain authoritative.

Tests cover verified usable links, expired link usability windows, stale pending
without duplicate initialization, terminal finalization/reservation release,
fresh quotes/new references after terminal status, legitimate late success,
one entitlement and successful replay. Production query projections were
verified read-only with a synthetic user ID (HTTP 200 for basket and legacy).

A fresh checkout for the recovered production match is no longer blocked by
this payment. It remains subject to current match eligibility, ownership and a
new server quote. No fresh production checkout was initialized during repair.
