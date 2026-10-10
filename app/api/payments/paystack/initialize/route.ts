import { getCustomerAccess } from "@/lib/auth/access";
import { commercialStage, hasPredictionAccess } from "@/lib/auth/match-access";
import { getCurrentUser } from "@/lib/auth/session";
import { parseCheckoutRequest } from "@/lib/payments/checkout";
import { createPaystackClient, getTrustedSiteOrigin, PaystackConfigurationError } from "@/lib/payments/paystack";
import { initializePredictionPayment } from "@/lib/payments/service";
import { isDeliverablePrematch } from "@/lib/predictive-compass/prematch";
import { getLiveFootballMatches, requestPrematchFreshness } from "@/lib/predictive-compass/server";
import { createCustomerAuthServerClient } from "@/lib/supabase/auth-server";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { initializeBasketPayment } from "@/lib/payments/basket-service";
import { BasketError, basketCheckoutSchema } from "@/lib/payments/match-pricing";
import { matchPricingV2Enabled } from "@/lib/payments/pricing-version";
import { loadPendingMatchCheckouts } from "@/lib/payments/pending-checkout";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.email) return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  try {
    if ((await getCustomerAccess())?.owner) return Response.json({ error: "PREMIUM_ALREADY_UNLOCKED" }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "ACCESS_CHECK_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  const body = await request.json().catch(() => null);
  if (matchPricingV2Enabled()) {
    const selected = basketCheckoutSchema.safeParse(body);
    if (!selected.success) return Response.json({ error: "ACCEPTED_QUOTE_REQUIRED" }, { status: 400 });
    try {
      const result = await initializeBasketPayment({ admin: getServerSupabaseClient(), paystack: createPaystackClient(), userId: user.id, email: user.email, quoteId: selected.data.quote_id, callbackOrigin: getTrustedSiteOrigin() });
      return Response.json({ authorization_url: result.authorizationUrl, reference: result.reference }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof BasketError && ["CHECKOUT_ALREADY_PENDING", "CHECKOUT_VERIFICATION_REQUIRED"].includes(error.code)) {
        const pending = await loadPendingMatchCheckouts(getServerSupabaseClient(), user.id).catch(() => []);
        // The accepted quote's overlapping reservation remains authoritative.
        // Return recovery actions rather than initializing another transaction.
        return Response.json({ error: error.code, pending_checkouts: pending }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
      }
      return Response.json({ error: error instanceof BasketError ? error.code : error instanceof PaystackConfigurationError ? "PAYSTACK_CONFIGURATION_REQUIRED" : "CHECKOUT_UNAVAILABLE" }, { status: error instanceof BasketError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  const parsed = parseCheckoutRequest(body);
  if (!parsed.success) return Response.json({ error: "INVALID_PRODUCT" }, { status: 400 });

  try {
    const [access, customerClient] = await Promise.all([getCustomerAccess(), createCustomerAuthServerClient()]);
    const result = await initializePredictionPayment({
      admin: getServerSupabaseClient(),
      paystack: createPaystackClient(),
      userId: user.id,
      email: user.email,
      productId: parsed.data.product_id,
      callbackOrigin: getTrustedSiteOrigin(),
      hasExistingAccess: async (product) => (await Promise.all(product.prediction_access_product_matches.map((match) =>
        hasPredictionAccess({ access, supabase: customerClient, matchId: match.match_id, stage: product.prediction_stage }),
      ))).every(Boolean),
      lifecycleAllows: async (product) => {
        if (product.prediction_stage === "prematch") {
          const readiness = await Promise.all(product.prediction_access_product_matches.map((member) =>
            requestPrematchFreshness(member.match_id),
          ));
          return readiness.every((result) => isDeliverablePrematch(result));
        }
        const live = await getLiveFootballMatches();
        return product.prediction_access_product_matches.every((member) => {
          const match = live.matches.find((candidate) => candidate.match_id === member.match_id);
          return match ? commercialStage(match.stage) === product.prediction_stage : false;
        });
      },
    });
    if ("error" in result) {
      const status = result.error === "PRODUCT_NOT_AVAILABLE" ? 409 : result.error === "ACCESS_ALREADY_GRANTED" ? 409 : 503;
      return Response.json({ error: result.error }, { status });
    }
    return Response.json({ authorization_url: result.authorizationUrl, reference: result.reference });
  } catch (error) {
    if (error instanceof PaystackConfigurationError) return Response.json({ error: "PAYSTACK_CONFIGURATION_REQUIRED" }, { status: 503 });
    return Response.json({ error: "PAYMENT_INITIALIZATION_FAILED" }, { status: 503 });
  }
}
