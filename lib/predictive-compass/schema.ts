import { z } from "zod";

export const footballStageSchema = z.enum([
  "PREMATCH",
  "FIRST_HALF_LIVE",
  "HALFTIME",
  "SECOND_HALF_LIVE",
  "FINAL",
]);

export const footballMatchIdSchema = z.string().regex(/^fm_[a-f0-9]{32}$/);

export const footballProbabilitiesSchema = z.object({
  home_win: z.number().min(0).max(100),
  draw: z.number().min(0).max(100),
  away_win: z.number().min(0).max(100),
});

export const footballScoreSchema = z.object({
  home: z.number().int().nonnegative(),
  away: z.number().int().nonnegative(),
});

export const footballReliabilitySchema = z.object({
  score: z.number().min(0).max(100).nullable(),
  label: z.enum(["Low", "Moderate", "High", "Unavailable"]),
});

export const footballLivePredictionSchema = z
  .object({
    predicted_outcome: z.enum(["home_win", "draw", "away_win"]),
    predicted_score: footballScoreSchema.nullable(),
    probabilities: footballProbabilitiesSchema,
    reliability: footballReliabilitySchema,
    verification_status: z.string().min(1),
    important_information_pending: z.boolean(),
    customer_summary: z.string().min(1),
    customer_key_factors: z.array(z.string().min(1)).max(3),
  })
  .strip();

export const footballPredictionSchema = z
  .object({
    match_id: footballMatchIdSchema.nullable(),
    prediction_id: z.string().min(1),
    competition: z.string().min(1),
    home_team: z.string().min(1),
    away_team: z.string().min(1),
    kickoff_at: z.string().datetime({ offset: true }).nullable(),
    stage: footballStageSchema,
    predicted_outcome: z.enum(["home_win", "draw", "away_win"]),
    predicted_score: footballScoreSchema.nullable(),
    probabilities: footballProbabilitiesSchema,
    reliability: footballReliabilitySchema,
    verification_status: z.string().min(1),
    important_information_pending: z.boolean(),
    customer_summary: z.string().min(1),
    customer_key_factors: z.array(z.string().min(1)).max(3),
    generated_at: z.string().datetime({ offset: true }).nullable(),
    updated_at: z.string().datetime({ offset: true }).nullable(),
    evidence_cutoff_at: z.string().datetime({ offset: true }).nullable().optional(),
    last_intelligence_refresh_at: z.string().datetime({ offset: true }).nullable().optional(),
    refresh_reason: z.string().nullable().optional(),
  })
  .strip();

export type FootballPrediction = z.infer<typeof footballPredictionSchema>;

export const footballPrematchFreshnessSchema = z.object({
  match_id: footballMatchIdSchema,
  prediction: footballPredictionSchema,
  freshness_status: z.enum(["fresh", "stale", "frozen", "unavailable"]),
  refresh_status: z.enum(["not_required", "queued", "in_progress", "completed", "failed", "blocked"]),
  maximum_age_seconds: z.number().int().nonnegative().nullable(),
  snapshot_age_seconds: z.number().int().nonnegative().nullable(),
}).strip();

export type FootballPrematchFreshness = z.infer<typeof footballPrematchFreshnessSchema>;

export const footballLiveMatchSchema = z
  .object({
    match_id: footballMatchIdSchema,
    competition: z.string().min(1),
    home_team: z.string().min(1),
    away_team: z.string().min(1),
    kickoff_at: z.string().datetime({ offset: true }).nullable(),
    status: z.string().min(1),
    minute: z.number().int().min(0).max(130).nullable(),
    added_time: z.number().int().min(0).max(30).nullable(),
    current_score: footballScoreSchema.nullable(),
    stage: footballStageSchema,
    latest_prediction: footballLivePredictionSchema.nullable(),
    updated_at: z.string().datetime({ offset: true }).nullable(),
  })
  .strip();

export const footballLiveMatchPreviewSchema = z
  .object({
    match_id: footballMatchIdSchema,
    competition: z.string().min(1),
    home_team: z.string().min(1),
    away_team: z.string().min(1),
    kickoff_at: z.string().datetime({ offset: true }).nullable(),
    status: z.string().min(1),
    minute: z.number().int().min(0).max(130).nullable(),
    added_time: z.number().int().min(0).max(30).nullable(),
    current_score: footballScoreSchema.nullable(),
    stage: footballStageSchema,
    updated_at: z.string().datetime({ offset: true }).nullable(),
    prediction_available: z.boolean(),
    locked: z.literal(true),
    offers: z.array(z.object({
      productId: z.string().uuid(),
      name: z.string().min(1),
      scopeType: z.enum(["match", "kickoff_slot"]),
      priceAmount: z.number().nonnegative().nullable(),
      currency: z.string().regex(/^[A-Z]{3}$/),
      matchCount: z.number().int().positive(),
    }).strict()),
  })
  .strict();

export const footballLiveMatchListSchema = z
  .object({
    domain: z.literal("football"),
    matches: z.array(z.unknown()),
  })
  .transform(({ matches }) => ({
    domain: "football" as const,
    matches: matches.map((match) => footballLiveMatchSchema.parse(match)),
  }));

export const footballCustomerLiveMatchListSchema = z
  .object({
    domain: z.literal("football"),
    matches: z.array(z.unknown()),
  })
  .transform(({ matches }) => ({
    domain: "football" as const,
    matches: matches.map((match) =>
      z.union([footballLiveMatchSchema, footballLiveMatchPreviewSchema]).parse(match),
    ),
  }));

export const footballMatchPredictionSchema = z
  .object({
    match_id: footballMatchIdSchema,
    competition: z.string().min(1),
    home_team: z.string().min(1),
    away_team: z.string().min(1),
    kickoff_at: z.string().datetime({ offset: true }).nullable(),
    status: z.string().min(1),
    minute: z.number().int().min(0).max(130).nullable(),
    added_time: z.number().int().min(0).max(30).nullable(),
    current_score: footballScoreSchema.nullable(),
    stage: footballStageSchema,
    prediction: footballLivePredictionSchema,
    updated_at: z.string().datetime({ offset: true }).nullable(),
  })
  .strip();

export const footballPredictionHistoryEntrySchema = z
  .object({
    stage: footballStageSchema,
    minute: z.number().int().min(0).max(130).nullable(),
    current_score: footballScoreSchema.nullable(),
    predicted_outcome: z.enum(["home_win", "draw", "away_win"]),
    predicted_score: footballScoreSchema.nullable(),
    probabilities: footballProbabilitiesSchema,
    reliability: footballReliabilitySchema,
    generated_at: z.string().datetime({ offset: true }).nullable(),
    change_reason: z.enum([
      "interval_update",
      "goal",
      "red_card",
      "penalty",
      "score_correction",
      "halftime",
      "match_started",
      "final",
      "update",
    ]),
    change_description: z.string().min(1),
  })
  .strip();

export const footballLockedHistoryEntrySchema = z.object({
  stage: footballStageSchema,
  minute: z.number().int().min(0).max(130).nullable(),
  generated_at: z.string().datetime({ offset: true }).nullable(),
  locked: z.literal(true),
}).strict();

export const footballPredictionHistorySchema = z
  .object({
    match_id: footballMatchIdSchema,
    competition: z.string().min(1),
    home_team: z.string().min(1),
    away_team: z.string().min(1),
    kickoff_at: z.string().datetime({ offset: true }).nullable(),
    history: z.array(z.unknown()),
  })
  .transform((history) => ({
    ...history,
    history: history.history.map((entry) => z.union([
      footballPredictionHistoryEntrySchema,
      footballLockedHistoryEntrySchema,
    ]).parse(entry)),
  }));

export type FootballStage = z.infer<typeof footballStageSchema>;
export type FootballLivePrediction = z.infer<typeof footballLivePredictionSchema>;
export type FootballLiveMatch = z.infer<typeof footballLiveMatchSchema>;
export type FootballLiveMatchPreview = z.infer<typeof footballLiveMatchPreviewSchema>;
export type FootballLiveMatchView = FootballLiveMatch | FootballLiveMatchPreview;
export type FootballLiveMatchList = z.infer<typeof footballLiveMatchListSchema>;
export type FootballMatchPrediction = z.infer<typeof footballMatchPredictionSchema>;
export type FootballPredictionHistory = z.infer<typeof footballPredictionHistorySchema>;
export type FootballPredictionHistoryEntry = z.infer<typeof footballPredictionHistoryEntrySchema>;
export type FootballLockedHistoryEntry = z.infer<typeof footballLockedHistoryEntrySchema>;

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
