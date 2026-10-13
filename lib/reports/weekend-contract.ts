import {z} from "zod";
import {footballMatchIdSchema,footballScoreSchema} from "../predictive-compass/schema";

// FootballCompletedFixtureList, serialized by Core's protected completed route.
export const completedFixtureSchema=z.object({
 match_id:footballMatchIdSchema,competition:z.string().min(1),home_team:z.string().min(1),away_team:z.string().min(1),
 kickoff_at:z.string().datetime({offset:true}),status:z.literal("FINAL"),final_score:footballScoreSchema.strict(),
 home_team_identity:z.null(),away_team_identity:z.null(),free_prematch_available:z.boolean(),premium_prematch_available:z.boolean(),
 live_history_available:z.boolean(),premium_classification:z.enum(["OFFICIAL_PREMATCH","LEGACY_PREMATCH"]).nullable(),
}).strict();
export const completedFixturesSchema=z.object({from:z.iso.date(),to:z.iso.date(),matches:z.array(completedFixtureSchema)}).strict()
 .refine(value=>new Set(value.matches.map(m=>m.match_id)).size===value.matches.length,"Duplicate completed fixture");
export type CompletedFixture=z.infer<typeof completedFixtureSchema>;
