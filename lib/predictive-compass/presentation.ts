import type { FootballPrediction } from "./schema";

export function formatPredictedOutcome(
  prediction: Pick<
    FootballPrediction,
    "predicted_outcome" | "home_team" | "away_team"
  >,
) {
  if (prediction.predicted_outcome === "home_win") {
    return `${prediction.home_team} Win`;
  }

  if (prediction.predicted_outcome === "away_win") {
    return `${prediction.away_team} Win`;
  }

  return "Draw";
}

export function formatReliability(
  reliability: FootballPrediction["reliability"],
) {
  return reliability.label;
}

export function formatProbability(value: number) {
  return `${Math.round(value)}%`;
}
