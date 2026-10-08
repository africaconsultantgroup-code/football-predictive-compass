import "server-only";
import { getCustomerAccess } from "../auth/access";
import { hasPredictionAccess } from "../auth/match-access";
import { createCustomerAuthServerClient } from "../supabase/auth-server";
import { CoreClientError, requestPrematchFreshness, getUpcomingFootballPredictions, getPremiumFootballPrediction } from "./server";
import { paidPrematchSnapshot } from "./prematch";

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
    prediction = paidPrematchSnapshot(freshness);
  } catch (error) {
    if (!(error instanceof CoreClientError)) throw error;
    prediction = (await getUpcomingFootballPredictions({ syncProducts: false }))
      .find(item => item.match_id === matchId && item.stage === "PREMATCH" && item.kickoff_at !== null && new Date(item.kickoff_at) > new Date());
  }
  return prediction ? getPremiumFootballPrediction(prediction.prediction_id, matchId) : null;
}
