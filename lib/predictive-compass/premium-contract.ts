import { z } from "zod";
import { footballProbabilitiesSchema, footballScoreSchema } from "./schema";

const probability = z.number().min(0).max(100);
const timestamp = z.string().datetime({ offset: true }).nullable();
const outcome = z.enum(["home_win", "draw", "away_win"]);
const strength = z.enum(["Strong", "Moderate", "Cautious", "Unavailable"]);
const availability = z.enum(["available", "unavailable"]);
const probabilities = footballProbabilitiesSchema.strict().refine(p => Math.abs(p.home_win + p.draw + p.away_win - 100) < 0.02);
const score = footballScoreSchema.strict();

// Exact customer-premium-intelligence-contract.md objects. Unknown fields fail closed.
export const premiumIntelligenceSchema = z.object({
  primary_forecast: z.object({ probabilities, most_likely_outcome: outcome, generated_at: timestamp, status: z.string().min(1) }).strict(),
  compass_pick: z.object({ market: z.literal("Match Result"), selection: z.string().min(1), model_probability: probability, strength, generated_at: timestamp }).strict(),
  market_opportunities: z.array(z.object({ rank: z.number().int().min(1).max(5), market: z.literal("Match Result"), selection: z.string().min(1), probability, strength, preferred: z.boolean() }).strict()).max(5),
  bookmaker_comparison: z.array(z.object({ selection: z.string().min(1), bookmaker_implied_probability: probability, bookmaker_consensus_fair_odds: z.number().gt(1), compass_probability: probability, compass_fair_odds: z.number().min(1), probability_difference: z.number() }).strict()),
  intelligence_reasons: z.array(z.object({ category: z.enum(["Team News", "Player Availability", "Formation / Tactical Setup", "Team Strength", "Home/Away Context", "Rest", "Congestion", "Travel", "Market Movement", "Match Conditions"]), summary: z.string().min(1) }).strict()).max(5),
  forecast_change: z.object({ available: z.boolean(), free_leading_outcome: outcome.nullable(), free_probability: probability.nullable(), premium_leading_outcome: outcome.nullable(), premium_probability: probability.nullable(), probability_point_change: z.number().nullable(), leading_outcome_changed: z.boolean().nullable(), reasons: z.array(z.string()).max(3) }).strict(),
  recommendation_strength: z.object({ label: strength, score: probability.nullable() }).strict(),
  score_forecast: z.object({ status: availability, most_likely_score: score.nullable(), score_probability: probability.nullable(), alternative_scorelines: z.array(score) }).strict(),
  generated_at: timestamp,
  availability: z.object({ compass_pick: availability, market_opportunities: availability, bookmaker_comparison: availability, intelligence_reasons: availability, forecast_change: availability, score_forecast: availability }).strict(),
}).strict().superRefine((p, ctx) => {
  const fail = (path: string) => ctx.addIssue({ code: "custom", path: [path], message: "Inconsistent availability" });
  for (const row of p.market_opportunities) {
    if (row.preferred !== (row.rank === 1)) fail("market_opportunities");
  }
  for (const key of ["bookmaker_comparison", "intelligence_reasons"] as const) {
    if ((p.availability[key] === "unavailable") !== (p[key].length === 0)) fail(key);
  }
  const change = p.forecast_change;
  if ((p.availability.forecast_change === "available") !== change.available) fail("forecast_change");
  const changeValues = [change.free_leading_outcome, change.free_probability, change.premium_leading_outcome, change.premium_probability, change.probability_point_change, change.leading_outcome_changed];
  if (change.available ? changeValues.some(v => v === null) : changeValues.some(v => v !== null) || change.reasons.length > 0) fail("forecast_change");
  const scored = p.score_forecast;
  if (p.availability.score_forecast !== scored.status || (scored.status === "available" ? scored.most_likely_score === null : scored.most_likely_score !== null || scored.score_probability !== null || scored.alternative_scorelines.length > 0)) fail("score_forecast");
});

export type PremiumIntelligence = z.infer<typeof premiumIntelligenceSchema>;
