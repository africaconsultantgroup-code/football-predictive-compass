import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function finalizePredictionAccessProduct(
  admin: SupabaseClient,
  productId: string,
) {
  const { data, error } = await admin.rpc("finalize_prediction_access_product", {
    requested_product_id: productId,
  });
  if (error) throw new Error("Prediction product could not be finalized.");
  return Number(data);
}
