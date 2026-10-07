import { z } from "zod";
import { footballMatchIdSchema, footballPredictionSchema, footballProbabilitiesSchema } from "./schema";
import { freePrematchSchema, type FreePrematchPrediction } from "./free";

export const premiumCustomerSchema = z.object({
  match_id: footballMatchIdSchema,
  competition: z.string().min(1), home_team: z.string().min(1), away_team: z.string().min(1),
  kickoff_at: z.string().datetime({ offset: true }).nullable(),
  stage: z.literal("PREMATCH"), tier: z.literal("premium"), status: z.literal("available"),
  probabilities: footballProbabilitiesSchema.strict().refine(p => Math.abs(p.home_win+p.draw+p.away_win-100) < 0.02),
  predicted_outcome: z.enum(["home_win", "draw", "away_win"]),
  generated_at: z.string().datetime({ offset: true }).nullable(),
  updated_at: z.string().datetime({ offset: true }).nullable(),
  // No approved evidence-category/recommendation/advanced-score publication exists.
  // Fail closed; do not infer these from probabilities or free-text factors.
  explanation_categories: z.array(z.never()).max(0),
  compass_pick: z.null(), market_opportunities: z.array(z.never()).max(0), score_forecast: z.null(),
}).strict().refine(p => p.probabilities[p.predicted_outcome] === Math.max(...Object.values(p.probabilities)));

export type PremiumCustomerPrediction = z.infer<typeof premiumCustomerSchema>;

export function toPremiumCustomerPrediction(value: unknown): PremiumCustomerPrediction {
  const source = footballPredictionSchema.parse(value);
  return premiumCustomerSchema.parse({
    match_id: source.match_id, competition: source.competition, home_team: source.home_team,
    away_team: source.away_team, kickoff_at: source.kickoff_at, stage: source.stage,
    tier: "premium", status: "available", predicted_outcome: source.predicted_outcome,
    probabilities: { home_win: source.probabilities.home_win, draw: source.probabilities.draw, away_win: source.probabilities.away_win },
    generated_at: source.generated_at, updated_at: source.updated_at,
    explanation_categories: [], compass_pick: null, market_opportunities: [], score_forecast: null,
  });
}

export function compareForecasts(freeValue: FreePrematchPrediction | null, premiumValue: PremiumCustomerPrediction | null, now = new Date()) {
  const free = freePrematchSchema.safeParse(freeValue);
  const premium = premiumCustomerSchema.safeParse(premiumValue);
  if (!free.success || free.data.status !== "available" || !premium.success) return null;
  const a = free.data, b = premium.data;
  if (a.match_id !== b.match_id || a.competition !== b.competition || a.home_team !== b.home_team || a.away_team !== b.away_team || !a.kickoff_at || !b.kickoff_at || !b.generated_at) return null;
  const kickoff = Date.parse(a.kickoff_at), freeAt = Date.parse(a.generated_at), premiumAt = Date.parse(b.generated_at);
  if (kickoff !== Date.parse(b.kickoff_at) || freeAt > premiumAt || premiumAt > now.getTime() || premiumAt >= kickoff || freeAt >= kickoff) return null;
  const difference = (key: "home_win" | "draw" | "away_win") => Math.round((b.probabilities[key]-a.probabilities[key])*100)/100 || 0;
  return {
    free: a, premium: b, leading_outcome_changed: a.predicted_outcome !== b.predicted_outcome,
    changes: { home_win: difference("home_win"), draw: difference("draw"), away_win: difference("away_win") },
  };
}
export type ForecastComparisonData = NonNullable<ReturnType<typeof compareForecasts>>;

export function premiumSummary(prediction: PremiumCustomerPrediction) {
  const outcome = prediction.predicted_outcome === "draw" ? "A draw" : `${prediction.predicted_outcome === "home_win" ? prediction.home_team : prediction.away_team} winning`;
  return `${outcome} is the most likely result at ${prediction.probabilities[prediction.predicted_outcome]}%. The forecast gives a home win ${prediction.probabilities.home_win}%, a draw ${prediction.probabilities.draw}% and an away win ${prediction.probabilities.away_win}%. These are possibilities, not guarantees.`;
}

export function createPremiumMatchHandler(authorize: (matchId: string) => Promise<"anonymous" | "locked" | "entitled">, load: (matchId: string) => Promise<unknown | null>) {
  return async (matchId: string) => {
    const headers = { "Cache-Control": "private, no-store" };
    if (!footballMatchIdSchema.safeParse(matchId).success) return Response.json({ error: "Invalid match identifier." }, { status: 400, headers });
    try {
      const access = await authorize(matchId);
      if (access !== "entitled") return Response.json({ error: access === "anonymous" ? "Authentication required." : "Premium access required." }, { status: access === "anonymous" ? 401 : 403, headers });
      const value = await load(matchId);
      if (value === null) return Response.json({ match_id: matchId, tier: "premium", status: "preparing" }, { status: 503, headers });
      const prediction = premiumCustomerSchema.parse(value);
      if (prediction.match_id !== matchId) throw new Error("Mismatched fixture");
      return Response.json(prediction, { headers });
    } catch {
      return Response.json({ match_id: matchId, tier: "premium", status: "preparing" }, { status: 503, headers });
    }
  };
}
