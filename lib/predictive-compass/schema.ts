import { z } from "zod";

export const footballPredictionSchema = z
  .object({
    prediction_id: z.string().min(1),
    competition: z.string().min(1),
    home_team: z.string().min(1),
    away_team: z.string().min(1),
    kickoff_at: z.string().datetime({ offset: true }).nullable(),
    stage: z.enum(["PREMATCH", "FIRST_HALF_LIVE", "HALFTIME", "SECOND_HALF_LIVE", "FINAL"]),
    predicted_outcome: z.enum(["home_win", "draw", "away_win"]),
    predicted_score: z.object({
      home: z.number().int().nonnegative(),
      away: z.number().int().nonnegative(),
    }).nullable(),
    probabilities: z.object({
      home_win: z.number().min(0).max(100),
      draw: z.number().min(0).max(100),
      away_win: z.number().min(0).max(100),
    }),
    reliability: z.object({
      score: z.number().min(0).max(100).nullable(),
      label: z.enum(["Low", "Moderate", "High", "Unavailable"]),
    }),
    verification_status: z.string().min(1),
    important_information_pending: z.boolean(),
    customer_summary: z.string().min(1),
    customer_key_factors: z.array(z.string().min(1)).max(3),
    generated_at: z.string().datetime({ offset: true }).nullable(),
    updated_at: z.string().datetime({ offset: true }).nullable(),
  })
  .strip();

export type FootballPrediction = z.infer<typeof footballPredictionSchema>;

const upcomingEnvelopeSchema = z.union([
  z.array(z.unknown()),
  z.object({ predictions: z.array(z.unknown()) }),
  z.object({ data: z.array(z.unknown()) }),
]);

export function parseUpcomingFootballPredictions(
  value: unknown,
): FootballPrediction[] {
  const envelope = upcomingEnvelopeSchema.parse(value);
  const predictions = Array.isArray(envelope)
    ? envelope
    : "predictions" in envelope
      ? envelope.predictions
      : envelope.data;

  return predictions.map((prediction) => footballPredictionSchema.parse(prediction));
}
