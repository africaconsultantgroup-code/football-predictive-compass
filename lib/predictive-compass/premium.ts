import { z } from "zod";
import { footballMatchIdSchema, footballPredictionSchema } from "./schema";
import { premiumIntelligenceSchema } from "./premium-contract";
import { teamIdentityFields } from "../teams/schema";
import { withTeamIdentities } from "../teams/identity";

// Fixture identity wraps the exact ten-field Premium DTO; engine envelope stays server-side.
export const premiumCustomerSchema = z.object({
  ...teamIdentityFields,
  match_id: footballMatchIdSchema,
  competition: z.string().min(1), home_team: z.string().min(1), away_team: z.string().min(1),
  kickoff_at: z.string().datetime({ offset: true }).nullable(),
  stage: z.literal("PREMATCH"), tier: z.literal("premium"), status: z.literal("available"),
  premium_intelligence: premiumIntelligenceSchema,
}).strict();
export type PremiumCustomerPrediction = z.infer<typeof premiumCustomerSchema>;

// An unavailable score can carry a residual probability in Core snapshots.
// Discard that unavailable section rather than losing all valid intelligence.
export function normalizePremiumAvailability(value: unknown): unknown {
  if (!value || typeof value !== "object" || !("premium_intelligence" in value)) return value;
  const intelligence = value.premium_intelligence;
  if (!intelligence || typeof intelligence !== "object" || !("availability" in intelligence) || !("score_forecast" in intelligence)) return value;
  const availability = intelligence.availability;
  const score = intelligence.score_forecast;
  if (!availability || typeof availability !== "object" || !("score_forecast" in availability) || availability.score_forecast !== "unavailable" || !score || typeof score !== "object" || !("status" in score) || score.status !== "unavailable") return value;
  return { ...value, premium_intelligence: { ...intelligence, score_forecast: { ...score, most_likely_score: null, score_probability: null, alternative_scorelines: [] } } };
}

export function toPremiumCustomerPrediction(value: unknown): PremiumCustomerPrediction {
  const source = footballPredictionSchema.extend({
    competition_code: z.enum(["premier-league", "uefa-champions-league"]),
    market_scope: z.literal("REGULATION_TIME_90_MINUTES"),
    evidence_cutoff_at: z.string().datetime({ offset: true }).nullable(),
    last_intelligence_refresh_at: z.string().datetime({ offset: true }).nullable(),
    refresh_reason: z.string().nullable(),
    premium_intelligence: premiumIntelligenceSchema,
  }).parse(withTeamIdentities(normalizePremiumAvailability(value)));
  return premiumCustomerSchema.parse({
    ...(source.home_team_identity ? {home_team_identity:source.home_team_identity} : {}), ...(source.away_team_identity ? {away_team_identity:source.away_team_identity} : {}),
    match_id: source.match_id, competition: source.competition, home_team: source.home_team,
    away_team: source.away_team, kickoff_at: source.kickoff_at, stage: source.stage,
    tier: "premium", status: "available", premium_intelligence: source.premium_intelligence,
  });
}

export function createPremiumMatchHandler(authorize: (matchId: string) => Promise<"anonymous" | "locked" | "entitled">, load: (matchId: string) => Promise<unknown | null>) {
  return async (matchId: string) => {
    const headers = { "Cache-Control": "private, no-store" };
    if (!footballMatchIdSchema.safeParse(matchId).success) return Response.json({ error: "Invalid match identifier." }, { status: 400, headers });
    try {
      const access = await authorize(matchId);
      if (access !== "entitled") return Response.json({ error: access === "anonymous" ? "Authentication required." : "Premium access required." }, { status: access === "anonymous" ? 401 : 403, headers });
      const prediction = premiumCustomerSchema.parse(await load(matchId));
      if (prediction.match_id !== matchId) throw new Error("Mismatched fixture");
      return Response.json(prediction, { headers });
    } catch {
      return Response.json({ match_id: matchId, tier: "premium", status: "preparing" }, { status: 503, headers });
    }
  };
}
