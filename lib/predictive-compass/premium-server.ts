import "server-only";
import { getCustomerAccess } from "../auth/access";
import { hasPredictionAccess } from "../auth/match-access";
import { createCustomerAuthServerClient } from "../supabase/auth-server";
import { CoreClientError, requestPrematchFreshness, getUpcomingFootballPredictions, getPremiumFootballPrediction } from "./server";

export async function authorizePremiumMatch(matchId: string) {
  const access = await getCustomerAccess();
  if (!access.customer) return "anonymous" as const;
  const entitled = await hasPredictionAccess({ access, supabase: await createCustomerAuthServerClient(), matchId, stage: "prematch" });
  return entitled ? "entitled" as const : "locked" as const;
}

export async function loadPremiumMatch(matchId: string) {
  let prediction;
  try {
    const freshness = await requestPrematchFreshness(matchId);
    // Ownership survives kickoff and freshness state; these only gate a new sale.
    prediction = freshness.prediction;
  } catch (error) {
    if (!(error instanceof CoreClientError)) throw error;
    prediction = (await getUpcomingFootballPredictions({ syncProducts: false }))
      .find(item => item.match_id === matchId && item.stage === "PREMATCH");
  }
  return prediction?.match_id === matchId && prediction.stage === "PREMATCH" ? getPremiumFootballPrediction(prediction.prediction_id, matchId) : null;
}
