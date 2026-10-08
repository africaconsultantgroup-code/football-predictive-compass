// Contract-shaped illustrative values for tests only; never used as a forecast source.
import type { PremiumIntelligence } from "./premium-contract";
export const premiumIntelligenceFixture: PremiumIntelligence = {
  primary_forecast: { probabilities: { home_win: 58, draw: 25, away_win: 17 }, most_likely_outcome: "home_win", generated_at: "2026-10-09T10:00:00Z", status: "verified" },
  compass_pick: { market: "Match Result", selection: "Home FC to win", model_probability: 58, strength: "Moderate", generated_at: "2026-10-09T10:00:00Z" },
  market_opportunities: [
    { rank: 1, market: "Match Result", selection: "Home FC to win", probability: 58, strength: "Moderate", preferred: true },
    { rank: 2, market: "Match Result", selection: "Draw", probability: 25, strength: "Moderate", preferred: false },
    { rank: 3, market: "Match Result", selection: "Away FC to win", probability: 17, strength: "Moderate", preferred: false },
  ],
  bookmaker_comparison: [{ selection: "Home FC to win", bookmaker_implied_probability: 46, bookmaker_consensus_fair_odds: 2.17, compass_probability: 58, compass_fair_odds: 1.72, probability_difference: 12 }],
  intelligence_reasons: [{ category: "Team Strength", summary: "Relative team strength is relevant to this forecast." }],
  forecast_change: { available: false, free_leading_outcome: null, free_probability: null, premium_leading_outcome: null, premium_probability: null, probability_point_change: null, leading_outcome_changed: null, reasons: [] },
  recommendation_strength: { label: "Moderate", score: 65 },
  score_forecast: { status: "available", most_likely_score: { home: 2, away: 1 }, score_probability: 14, alternative_scorelines: [] },
  generated_at: "2026-10-09T10:00:00Z",
  availability: { compass_pick: "available", market_opportunities: "available", bookmaker_comparison: "available", intelligence_reasons: "available", forecast_change: "unavailable", score_forecast: "available" },
};
