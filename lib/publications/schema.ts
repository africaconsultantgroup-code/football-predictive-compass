import { z } from "zod";

const percentage = z.number().finite().min(0).max(100);
const score = z.number().int().min(0).max(32767);
const timestamp = z.string().datetime({ offset: true });

export const publicPredictionSchema = z
  .object({
    public_prediction_id: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
    league: z.string().trim().min(1).max(200),
    home_team: z.string().trim().min(1).max(200),
    away_team: z.string().trim().min(1).max(200),
    kickoff_at: timestamp,
    predicted_winner: z.enum(["home", "draw", "away"]),
    predicted_home_score: score,
    predicted_away_score: score,
    home_win_percentage: percentage,
    draw_percentage: percentage,
    away_win_percentage: percentage,
    confidence_percentage: percentage,
    customer_summary: z.string().trim().min(1).max(4000),
    customer_key_factors: z.array(z.string().trim().min(1).max(500)).max(20),
    publication_status: z.enum([
      "published",
      "updated",
      "withdrawn",
      "settled",
    ]),
    source_updated_at: timestamp,
    publication_version: z.number().int().positive(),
    published_at: timestamp,
    settlement_status: z.string().trim().min(1).max(100).nullable().optional(),
    actual_home_score: score.nullable().optional(),
    actual_away_score: score.nullable().optional(),
    result_outcome: z.enum(["home", "draw", "away"]).nullable().optional(),
    settled_at: timestamp.nullable().optional(),
  })
  .strict()
  .superRefine((prediction, context) => {
    const total =
      prediction.home_win_percentage +
      prediction.draw_percentage +
      prediction.away_win_percentage;

    if (Math.abs(total - 100) > 0.001) {
      context.addIssue({
        code: "custom",
        message: "Outcome percentages must total 100.",
        path: ["home_win_percentage"],
      });
    }

    if (
      prediction.home_team.toLocaleLowerCase() ===
      prediction.away_team.toLocaleLowerCase()
    ) {
      context.addIssue({
        code: "custom",
        message: "Home and away teams must differ.",
        path: ["away_team"],
      });
    }
  });

export type PublicPrediction = z.infer<typeof publicPredictionSchema>;
