import "server-only";

// Migration first, then enable deliberately. Existing production is unaffected.
export function matchPricingV2Enabled() { return process.env.PREDICTIVE_CUSTOMER_PRICING_VERSION === "v2"; }
