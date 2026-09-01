import type {
  FootballLiveMatch,
  FootballLiveMatchList,
  FootballPrediction,
  FootballPredictionHistoryEntry,
} from "./schema";
import type { PredictionAccessOffer } from "../auth/match-access";

export type FootballPredictionPreview = Pick<
  FootballPrediction,
  "match_id" | "competition" | "home_team" | "away_team" | "kickoff_at" | "stage"
> & {
  prediction_id: string;
  prediction_available: true;
  locked: true;
  offers: PredictionAccessOffer[];
};

export type FootballLiveMatchPreview = Pick<
  FootballLiveMatch,
  | "match_id"
  | "competition"
  | "home_team"
  | "away_team"
  | "kickoff_at"
  | "status"
  | "minute"
  | "added_time"
  | "current_score"
  | "stage"
  | "updated_at"
> & {
  prediction_available: boolean;
  locked: true;
  offers: PredictionAccessOffer[];
};

export function toPredictionPreview(
  prediction: FootballPrediction,
  offers: PredictionAccessOffer[] = [],
): FootballPredictionPreview {
  return {
    match_id: prediction.match_id,
    prediction_id: prediction.prediction_id,
    competition: prediction.competition,
    home_team: prediction.home_team,
    away_team: prediction.away_team,
    kickoff_at: prediction.kickoff_at,
    stage: prediction.stage,
    prediction_available: true,
    locked: true,
    offers,
  };
}

export function toLiveMatchPreview(
  match: FootballLiveMatch,
  offers: PredictionAccessOffer[] = [],
): FootballLiveMatchPreview {
  return {
    match_id: match.match_id,
    competition: match.competition,
    home_team: match.home_team,
    away_team: match.away_team,
    kickoff_at: match.kickoff_at,
    status: match.status,
    minute: match.minute,
    added_time: match.added_time,
    current_score: match.current_score,
    stage: match.stage,
    updated_at: match.updated_at,
    prediction_available: match.latest_prediction !== null,
    locked: true,
    offers,
  };
}

export function toLiveListPreview(list: FootballLiveMatchList, offers: PredictionAccessOffer[] = []) {
  return { domain: "football" as const, matches: list.matches.map((match) => toLiveMatchPreview(match, offers)) };
}

export function toLockedHistoryEntry(entry: FootballPredictionHistoryEntry) {
  return {
    stage: entry.stage,
    minute: entry.minute,
    generated_at: entry.generated_at,
    locked: true as const,
  };
}
