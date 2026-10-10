# Owner full Premium access

Active `owner` membership in the Customer database's protected `public.admin_users` table grants the existing prematch, live and timeline capabilities. The lookup uses the server service client and the verified authenticated UID. No browser metadata, hardcoded UID, payment record or per-match entitlement substitutes for that database role.

Owner cards show Premium Unlocked and View Premium Intelligence; the dashboard omits basket/payment summaries. Quote and Paystack initialization routes reject owner payment attempts before reservation/payment/provider work. Normal customers retain GH₵8 Pricing V2 and existing entitlement behavior. Revoking or deactivating the owner row removes the override on the next request.

491 tests passed, including owner lifecycle access, inactive/non-owner denial, direct intelligence UI, payment bypass and normal-customer regression coverage. TypeScript, lint and production build are required before release.

Account activation requires the UID to exist in the Customer project's `auth.users`. The requested upsert was rejected by the existing foreign key because the supplied UID exists in the separate Core project, not Customer Auth. No Auth identity was fabricated, no constraint was weakened, and no role was written to the Core database. A valid Customer UID is required to activate that account.
