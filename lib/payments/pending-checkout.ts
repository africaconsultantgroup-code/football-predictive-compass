import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BasketError, type BasketFixture } from "./match-pricing";
import { safePaystackCheckoutUrl, type PendingMatchCheckout } from "./checkout-link";

// Both existing commerce paths reserve matches. Read only this customer's rows;
// project display/payment recovery fields, never user or provider metadata.
export async function loadPendingMatchCheckouts(client: SupabaseClient, userId: string): Promise<PendingMatchCheckout[]> {
  const [baskets, legacy] = await Promise.all([
    client.from("match_basket_payments")
      .select("provider_reference,status,authorization_url,match_basket_quotes!inner(fixtures,total_pesewas)")
      .eq("user_id", userId).in("status", ["initialized", "pending", "grant_failed"]),
    client.from("prediction_payments")
      .select("provider_reference,status,amount,currency,prediction_access_products!inner(prediction_access_product_matches(match_id))")
      .eq("user_id", userId).in("status", ["initialized", "pending"]),
  ]);
  if (baskets.error || legacy.error) throw new BasketError("CHECKOUT_STATUS_UNAVAILABLE", 503);
  const result: PendingMatchCheckout[] = [];
  for (const row of baskets.data ?? []) {
    const quote = row.match_basket_quotes as unknown as { fixtures: BasketFixture[]; total_pesewas: number };
    if (!Array.isArray(quote?.fixtures)) continue;
    const fixtures = quote.fixtures.map(({ match_id, kickoff_at, competition, home_team, away_team }) => ({ match_id, kickoff_at, competition, home_team, away_team }));
    result.push({ reference: row.provider_reference, authorizationUrl: row.status === "pending" ? safePaystackCheckoutUrl(row.authorization_url) : null, matchIds: fixtures.map(item => item.match_id), fixtures, totalPesewas: quote.total_pesewas });
  }
  for (const row of legacy.data ?? []) {
    const product = row.prediction_access_products as unknown as { prediction_access_product_matches: { match_id: string }[] };
    result.push({ reference: row.provider_reference, authorizationUrl: null, matchIds: product.prediction_access_product_matches.map(item => item.match_id), fixtures: [], totalPesewas: row.currency === "GHS" ? Math.round(Number(row.amount) * 100) : null });
  }
  return result;
}

