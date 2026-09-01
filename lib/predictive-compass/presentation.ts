import type { FootballPrediction, FootballStage } from "./schema";

export function formatPredictedOutcome(
  prediction: {
    predicted_outcome: "home_win" | "draw" | "away_win";
    home_team: string;
    away_team: string;
  },
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
  return `${value}%`;
}

export function formatFootballStage(stage: FootballStage) {
  const labels: Record<FootballStage, string> = {
    PREMATCH: "Pre-Match",
    FIRST_HALF_LIVE: "First Half \u00b7 Live",
    HALFTIME: "Half-Time",
    SECOND_HALF_LIVE: "Second Half \u00b7 Live",
    FINAL: "Full-Time",
  };
  return labels[stage];
}

export function isActivelyLive(stage: FootballStage) {
  return stage === "FIRST_HALF_LIVE" || stage === "SECOND_HALF_LIVE";
}

export function formatMatchMinute(
  minute: number | null,
  addedTime: number | null,
) {
  if (minute === null) return null;
  return `${minute}${addedTime ? `+${addedTime}` : ""}\u2032`;
}

export function formatChangeReason(reason: string) {
  const labels: Record<string, string> = {
    goal: "Goal",
    red_card: "Red Card",
    penalty: "Penalty",
    score_correction: "Score Update",
    halftime: "Half-Time",
    match_started: "Kick-Off",
    final: "Full-Time",
  };
  return labels[reason] ?? null;
}
