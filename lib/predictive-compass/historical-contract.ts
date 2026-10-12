import { z } from "zod";

const probability = z.number().min(0).max(100);
const timestamp = z.string().datetime({offset:true}).nullable();
const strength = z.enum(["Strong","Moderate","Cautious","Unavailable"]);
const score = z.object({home:z.number().int().nonnegative(),away:z.number().int().nonnegative()}).strict();
// Exact FootballHistoricalPremiumIntelligence serialization. No current readiness gate.
export const historicalPremiumSchema = z.object({
  access_status:z.enum(["LOCKED_PRE_KICKOFF","LEGACY_PREMATCH"]),
  label:z.enum(["Frozen Pre-Match Intelligence","Legacy Pre-Match Intelligence"]),
  official_performance_eligible:z.boolean(),
  probabilities:z.object({home_win:probability,draw:probability,away_win:probability}).strict().nullable(),
  compass_pick:z.object({market:z.literal("Match Result"),selection:z.string(),model_probability:probability,strength,generated_at:timestamp}).strict().nullable(),
  recommendation_strength:z.object({label:strength,score:probability.nullable()}).strict().nullable(),
  score_forecast:z.object({status:z.enum(["available","unavailable"]),most_likely_score:score.nullable(),score_probability:probability.nullable(),alternative_scorelines:z.array(score)}).strict().nullable(),
  bookmaker_comparison:z.array(z.object({selection:z.string(),bookmaker_implied_probability:probability,bookmaker_consensus_fair_odds:z.number().gt(1),compass_probability:probability,compass_fair_odds:z.number().min(1),probability_difference:z.number()}).strict()),
  intelligence_reasons:z.array(z.object({category:z.enum(["Team News","Player Availability","Formation / Tactical Setup","Team Strength","Home/Away Context","Rest","Congestion","Travel","Market Movement","Match Conditions"]),summary:z.string()}).strict()).max(5),
  generated_at:timestamp,evidence_cutoff_at:timestamp,
}).strict();
export type HistoricalPremium = z.infer<typeof historicalPremiumSchema>;
