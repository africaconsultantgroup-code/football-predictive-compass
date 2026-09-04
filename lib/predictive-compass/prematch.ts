import type { FootballPrematchFreshness, FootballPrediction } from "./schema";

export type PrematchReadiness = Pick<
  FootballPrematchFreshness,
  "match_id" | "freshness_status" | "refresh_status" | "maximum_age_seconds" | "snapshot_age_seconds"
> & {
  competition: string;
  home_team: string;
  away_team: string;
  kickoff_at: string | null;
  updated_at: string | null;
  deliverable: boolean;
};

export function isDeliverablePrematch(
  result: FootballPrematchFreshness,
  now = new Date(),
) {
  const prediction = result.prediction;
  return result.match_id === prediction.match_id
    && prediction.stage === "PREMATCH"
    && prediction.kickoff_at !== null
    && new Date(prediction.kickoff_at) > now
    && result.freshness_status !== "unavailable"
    && prediction.verification_status.trim().length > 0;
}

export function toPrematchReadiness(
  result: FootballPrematchFreshness,
  now = new Date(),
): PrematchReadiness {
  const prediction = result.prediction;
  return {
    match_id: result.match_id,
    competition: prediction.competition,
    home_team: prediction.home_team,
    away_team: prediction.away_team,
    kickoff_at: prediction.kickoff_at,
    updated_at: prediction.last_intelligence_refresh_at ?? prediction.updated_at ?? prediction.generated_at ?? null,
    freshness_status: result.freshness_status,
    refresh_status: result.refresh_status,
    maximum_age_seconds: result.maximum_age_seconds,
    snapshot_age_seconds: result.snapshot_age_seconds,
    deliverable: isDeliverablePrematch(result, now),
  };
}

export function paidPrematchSnapshot(
  result: FootballPrematchFreshness,
  now = new Date(),
): FootballPrediction | null {
  return isDeliverablePrematch(result, now) ? result.prediction : null;
}
