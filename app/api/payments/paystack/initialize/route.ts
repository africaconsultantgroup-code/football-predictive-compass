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

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.email) return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  const parsed = parseCheckoutRequest(await request.json().catch(() => null));
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
