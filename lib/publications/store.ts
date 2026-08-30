import "server-only";

import { getServerSupabaseClient } from "@/lib/supabase/server";
import { decidePredictionWrite, type WriteDecision } from "./freshness";
import type { PublicPrediction } from "./schema";

export async function storePublicPrediction(
  prediction: PublicPrediction,
): Promise<WriteDecision> {
  const supabase = getServerSupabaseClient();
  const { data: existing, error: lookupError } = await supabase
    .from("public_predictions")
    .select("publication_version, source_updated_at")
    .eq("public_prediction_id", prediction.public_prediction_id)
    .maybeSingle();

  if (lookupError) {
    throw new Error("Unable to inspect the existing prediction.");
  }

  const decision = decidePredictionWrite(existing, prediction);

  if (decision === "duplicate" || decision === "stale") {
    return decision;
  }

  const record = {
    ...prediction,
    settlement_status: prediction.settlement_status ?? null,
    actual_home_score: prediction.actual_home_score ?? null,
    actual_away_score: prediction.actual_away_score ?? null,
    result_outcome: prediction.result_outcome ?? null,
    settled_at: prediction.settled_at ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error: writeError } = await supabase
    .from("public_predictions")
    .upsert(record, { onConflict: "public_prediction_id" });

  if (writeError) {
    throw new Error("Unable to store the prediction.");
  }

  return decision;
}
