import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ownsPremiumMatch } from "../auth/match-access";
import { matchPricingV2Enabled } from "../payments/pricing-version";

// Presentation only: payment evidence never grants access. Existing grant/capability
// checks remain the sole entitlement decision.
export async function hasSuccessfulPrematchPurchase(supabase: SupabaseClient, userId: string, matchId: string) {
  if (matchPricingV2Enabled() && await ownsPremiumMatch(supabase, userId, matchId)) return true;
  const { data, error } = await supabase.from("prediction_payments")
    .select("id,prediction_access_products!inner(prediction_stage,prediction_access_product_matches!inner(match_id))")
    .eq("user_id", userId).eq("status", "successful").not("grant_id", "is", null)
    .eq("prediction_access_products.prediction_stage", "prematch")
    .eq("prediction_access_products.prediction_access_product_matches.match_id", matchId)
    .limit(1).maybeSingle();
  return !error && typeof data?.id === "string" && data.id.length > 0;
}
