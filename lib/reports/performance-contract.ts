import {z} from "zod";
import {premiumIntelligenceSchema} from "../predictive-compass/premium-contract";
import {footballProbabilitiesSchema,footballScoreSchema} from "../predictive-compass/schema";
const timestamp=z.string().datetime({offset:true});
const score=footballScoreSchema.strict();
const premium=premiumIntelligenceSchema.shape;
export const officialPerformanceRecordSchema=z.object({
 competition:z.string().min(1),competition_code:z.enum(["premier-league","uefa-champions-league"]),
 home_team:z.string().min(1),away_team:z.string().min(1),kickoff_at:timestamp.nullable(),
 compass_pick:premium.compass_pick.unwrap(),probabilities:footballProbabilitiesSchema.strict(),
 recommendation_strength:premium.recommendation_strength,score_forecast:premium.score_forecast,
 exact_score_probability:z.number().min(0).max(100).nullable(),
 bookmaker_comparison:premium.bookmaker_comparison,intelligence_reasons:premium.intelligence_reasons,
 generated_at:timestamp.nullable(),evidence_cutoff_at:timestamp.nullable(),
 premium_readiness_status:z.literal("READY"),released_at:timestamp,status:z.literal("FROZEN_PREMATCH"),
 settlement:z.object({actual_home_score:z.number().int().nonnegative(),actual_away_score:z.number().int().nonnegative(),actual_outcome:z.enum(["home_win","draw","away_win"]),compass_pick_correct:z.boolean(),predicted_score:score.nullable(),actual_score:score,exact_score_correct:z.boolean(),settled_at:timestamp,regulation_time:z.literal(true)}).strict().nullable(),
}).strict();
export const officialPerformanceSchema=z.object({domain:z.literal("football"),metric_source:z.literal("official_premium_prematch"),records:z.array(officialPerformanceRecordSchema)}).strict();
export type OfficialPerformance=z.infer<typeof officialPerformanceSchema>;
