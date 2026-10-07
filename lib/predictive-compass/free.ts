import { z } from "zod";
import { footballMatchIdSchema, footballProbabilitiesSchema } from "./schema";

const identity = {
  match_id: footballMatchIdSchema,
  competition: z.string().min(1),
  home_team: z.string().min(1),
  away_team: z.string().min(1),
  kickoff_at: z.string().datetime({ offset: true }).nullable(),
  stage: z.literal("PREMATCH"),
  tier: z.literal("free"),
};

// A transport contract, not evidence that a source satisfies the signal policy.
// No existing premium forecast is admitted as an available free forecast.
export const freePrematchSchema = z.discriminatedUnion("status", [
  z.object({ ...identity, status: z.literal("available"),
    probabilities: footballProbabilitiesSchema.strict().refine(p => Math.abs(p.home_win + p.draw + p.away_win - 100) < 0.02),
    predicted_outcome: z.enum(["home_win", "draw", "away_win"]),
    generated_at: z.string().datetime({ offset: true }),
  }).strict().refine(p => p.probabilities[p.predicted_outcome] === Math.max(...Object.values(p.probabilities))),
  z.object({ ...identity, status: z.literal("unavailable"), probabilities: z.null(),
    predicted_outcome: z.null(), generated_at: z.null(),
  }).strict(),
]);

export type FreePrematchPrediction = z.infer<typeof freePrematchSchema>;
export type FreeMatchIdentity = Pick<FreePrematchPrediction, "match_id" | "competition" | "home_team" | "away_team" | "kickoff_at">;

export function unavailableFreePrematch(match: FreeMatchIdentity): FreePrematchPrediction {
  // Explicit identity projection: never spread a premium prediction into this response.
  return freePrematchSchema.parse({ match_id: match.match_id, competition: match.competition,
    home_team: match.home_team, away_team: match.away_team, kickoff_at: match.kickoff_at,
    stage: "PREMATCH", tier: "free", status: "unavailable", probabilities: null,
    predicted_outcome: null, generated_at: null });
}

export function createFreePrematchHandler(load: (matchId: string) => Promise<unknown | null>) {
  return async (matchId: string) => {
    const headers = { "Cache-Control": "no-store" };
    if (!footballMatchIdSchema.safeParse(matchId).success) return Response.json({ error: "Invalid match identifier." }, { status: 400, headers });
    try {
      const value = await load(matchId);
      if (value === null) return Response.json({ error: "Match unavailable." }, { status: 404, headers });
      const prediction = freePrematchSchema.parse(value);
      if (prediction.match_id !== matchId) throw new Error("Mismatched free forecast");
      return Response.json(prediction, { headers });
    } catch {
      return Response.json({ error: "Free prediction temporarily unavailable." }, { status: 503, headers });
    }
  };
}
