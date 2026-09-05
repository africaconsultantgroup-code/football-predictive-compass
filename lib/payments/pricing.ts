import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type MatchPricingRule = {
  stage: "prematch" | "live" | "halftime";
  price: number;
  currency: string;
};

export async function getActiveMatchPricingRules(admin: SupabaseClient): Promise<MatchPricingRule[]> {
  const { data, error } = await admin
    .from("prediction_pricing_rules")
    .select("prediction_stage, base_price, currency")
    .eq("scope_type", "match")
    .eq("is_active", true)
    .order("base_price", { ascending: true });
  if (error || !data) return [];
  return (data as Array<{ prediction_stage: MatchPricingRule["stage"]; base_price: string | number; currency: string }>).map((rule) => ({
    stage: rule.prediction_stage,
    price: Number(rule.base_price),
    currency: rule.currency,
  }));
}

export async function finalizePredictionAccessProduct(
  admin: SupabaseClient,
  productId: string,
) {
  const { data, error } = await admin.rpc("finalize_prediction_access_product", {
    requested_product_id: productId,
  });
  if (error) throw new Error("Prediction product could not be finalized.");
  return Number(data);
}
