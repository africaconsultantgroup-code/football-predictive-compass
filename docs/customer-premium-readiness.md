# Customer Premium readiness

Mirrors `FootballPremiumReadiness` in Core's `app/domains/football/contracts.py` and the serialized object built in `adapter.py`:

```json
{
  "status": "PREPARING",
  "customer_visible": false,
  "reason": "PREMIUM_REQUIREMENTS_INCOMPLETE",
  "release_at": null,
  "last_late_refresh_at": null,
  "missing_requirements": []
}
```

All six keys are required when readiness is present. Status accepts PREPARING, READY, LOCKED_PRE_KICKOFF, LIVE and HISTORICAL. The timestamp fields accept ISO 8601 offset/UTC strings or null. `missing_requirements` is an array of strings. Unknown readiness fields fail strict parsing.

Readiness may be absent on the currently deployed older Core contract, but absence never grants visibility. The sole content gate is an explicit `customer_visible: true`; ownership and owner/admin privileges grant access only. Status and kickoff timestamps do not override visibility.

Core's hidden DTO supports null primary forecast and Compass Pick, empty lists, preparing section availability, and unavailable score forecast. The rest of the Premium DTO remains strict. Core currently sends customer_visible=false for LIVE and HISTORICAL, which remains hidden.

The detail page and protected Premium API require the current Core decision and also check the subsequently fetched detail DTO. A failed freshness request or a PREPARING decision cannot resurrect an older ready forecast. The owned match page does not mount its lifecycle intelligence feed until content visibility is granted. Owned prediction summaries apply the same gate. Separate Free forecasts remain available.

Purchase eligibility remains independent of content visibility, using the existing Pricing V2 eligibility and checkout. No amounts, entitlement rules, or provider integrations change.

Deployment order: deploy Customer first. Until Core deploys readiness, older Premium DTOs show the unlocked/preparing state. Core readiness rollout is external to this Customer release.
