import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { accessHasCapability, capabilities, type CustomerAccess } from "./access";

export type CommercialPredictionStage = "prematch" | "live" | "halftime";

export type PredictionGrantRow = {
  user_id: string;
  expires_at: string | null;
  prediction_access_products: {
    is_active: boolean;
    prediction_stage: string;
    prediction_access_product_matches: { match_id: string; kickoff_at: string }[];
  };
};

export function commercialStage(stage: string): CommercialPredictionStage | null {
  if (stage === "PREMATCH") return "prematch";
  if (stage === "HALFTIME") return "halftime";
  if (stage === "FIRST_HALF_LIVE" || stage === "SECOND_HALF_LIVE") return "live";
  return null;
}

function overrideCapability(stage: CommercialPredictionStage) {
  return stage === "prematch" ? capabilities.prematchFull : capabilities.liveFull;
}

export function grantMatches(
  grant: PredictionGrantRow,
  userId: string,
  matchId: string,
  stage: CommercialPredictionStage,
  now = new Date(),
) {
  return grant.user_id === userId
    && (!grant.expires_at || new Date(grant.expires_at) > now)
    && grant.prediction_access_products.is_active
    && grant.prediction_access_products.prediction_stage === stage
    && grant.prediction_access_products.prediction_access_product_matches.some((match) => match.match_id === matchId);
}

export async function hasPredictionAccess({
  access,
  supabase,
  matchId,
  stage,
  now = new Date(),
}: {
  access: CustomerAccess;
  supabase: SupabaseClient;
  matchId: string | null;
  stage: CommercialPredictionStage;
  now?: Date;
}) {
  if (accessHasCapability(access, overrideCapability(stage))) return true;
  if (!access.customer || !matchId) return false;

  const { data, error } = await supabase
    .from("prediction_access_grants")
    .select("user_id, expires_at, prediction_access_products!inner(is_active, prediction_stage, prediction_access_product_matches!inner(match_id, kickoff_at))")
    .eq("user_id", access.customer.id)
    .eq("prediction_access_products.prediction_stage", stage)
    .eq("prediction_access_products.is_active", true)
    .eq("prediction_access_products.prediction_access_product_matches.match_id", matchId)
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`);
  if (error || !data) return false;
  return (data as unknown as PredictionGrantRow[]).some((grant) =>
    grantMatches(grant, access.customer!.id, matchId, stage, now),
  );
}

export type PredictionAccessSummary = {
  productId: string;
  name: string;
  stage: CommercialPredictionStage;
  scopeType: "match" | "kickoff_slot";
  matchCount: number;
  expiresAt: string | null;
};

export type PredictionAccessOffer = {
  productId: string;
  name: string;
  scopeType: "match" | "kickoff_slot";
  priceAmount: number | null;
  currency: string;
  matchCount: number;
};

export async function getPredictionOffers(
  supabase: SupabaseClient,
  matchId: string | null,
  stage: CommercialPredictionStage,
): Promise<PredictionAccessOffer[]> {
  if (!matchId) return [];
  const membership = await supabase
    .from("prediction_access_product_matches")
    .select("product_id")
    .eq("match_id", matchId);
  const productIds = membership.data?.map(({ product_id }) => product_id) ?? [];
  if (membership.error || !productIds.length) return [];
  const { data, error } = await supabase
    .from("prediction_access_products")
    .select("id, name, scope_type, price_amount, currency, prediction_access_product_matches(match_id)")
    .eq("prediction_stage", stage)
    .eq("is_active", true)
    .in("id", productIds);
  if (error || !data) return [];
  return (data as unknown as Array<{ id: string; name: string; scope_type: "match" | "kickoff_slot"; price_amount: number | null; currency: string; prediction_access_product_matches: { match_id: string }[] }>).map((product) => ({
    productId: product.id,
    name: product.name,
    scopeType: product.scope_type,
    priceAmount: product.price_amount,
    currency: product.currency,
    matchCount: product.prediction_access_product_matches.length,
  })).filter((offer) => offer.scopeType === "match" || offer.matchCount >= 2);
}

export async function getActivePredictionGrants(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<PredictionAccessSummary[]> {
  const { data, error } = await supabase
    .from("prediction_access_grants")
    .select("expires_at, prediction_access_products!inner(id, name, scope_type, prediction_stage, is_active, prediction_access_product_matches(match_id))")
    .eq("user_id", userId)
    .eq("prediction_access_products.is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`);
  if (error || !data) return [];
  return (data as unknown as Array<{ expires_at: string | null; prediction_access_products: { id: string; name: string; scope_type: "match" | "kickoff_slot"; prediction_stage: CommercialPredictionStage; prediction_access_product_matches: { match_id: string }[] } }>).map((grant) => ({
    productId: grant.prediction_access_products.id,
    name: grant.prediction_access_products.name,
    stage: grant.prediction_access_products.prediction_stage,
    scopeType: grant.prediction_access_products.scope_type,
    matchCount: grant.prediction_access_products.prediction_access_product_matches.length,
    expiresAt: grant.expires_at,
  }));
}
