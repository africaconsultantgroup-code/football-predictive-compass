import "server-only";
import { getCustomerAccess } from "../auth/access";
import { hasPredictionAccess } from "../auth/match-access";
import { createCustomerAuthServerClient } from "../supabase/auth-server";
import { CoreClientError, requestPrematchFreshness, getPremiumFootballPrediction } from "./server";
import { premiumIntelligenceReady } from "./premium-readiness";
import {logReadFailure} from "./read-recovery";

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
    logReadFailure("premium_read_unavailable",matchId,"PREMATCH");
    // No current lifecycle decision: do not resurrect an older stored snapshot.
    return null;
  }
  if (prediction?.match_id !== matchId || !premiumIntelligenceReady(prediction)) return null;
  const premium = await getPremiumFootballPrediction(prediction.prediction_id, matchId);
  return premiumIntelligenceReady(premium) ? premium : null;
}
