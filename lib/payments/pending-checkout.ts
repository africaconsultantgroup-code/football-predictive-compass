import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BasketError, type BasketFixture } from "./match-pricing";
import { safePaystackCheckoutUrl, type PendingMatchCheckout } from "./checkout-link";

// Both existing commerce paths reserve matches. Read only this customer's rows;
// project display/payment recovery fields, never user or provider metadata.
export async function loadPendingMatchCheckouts(client: SupabaseClient, userId: string, options: { matchIds?: string[]; now?: Date; reconcile?: (reference: string) => Promise<{ status: string; checkoutUsable?: boolean }> } = {}): Promise<PendingMatchCheckout[]> {
  const [baskets, legacy] = await Promise.all([
    client.from("match_basket_payments")
      .select("provider_reference,status,authorization_url,match_basket_quotes!inner(fixtures,total_pesewas,expires_at)")
      .eq("user_id", userId).in("status", ["initialized", "pending", "grant_failed"]),
    client.from("prediction_payments")
      .select("provider_reference,status,amount,currency,prediction_access_products!inner(prediction_access_product_matches(match_id))")
      .eq("user_id", userId).in("status", ["initialized", "pending"]),
  ]);
  if (baskets.error || legacy.error) throw new BasketError("CHECKOUT_STATUS_UNAVAILABLE", 503);
  const result: PendingMatchCheckout[] = [];
  for (const row of baskets.data ?? []) {
    const quote = row.match_basket_quotes as unknown as { fixtures: BasketFixture[]; total_pesewas: number; expires_at: string };
    if (!Array.isArray(quote?.fixtures)) continue;
    const fixtures = quote.fixtures.map(({ match_id, kickoff_at, competition, home_team, away_team, home_team_identity, away_team_identity }) => ({ match_id, kickoff_at, competition, home_team, away_team, ...(home_team_identity ? {home_team_identity} : {}), ...(away_team_identity ? {away_team_identity} : {}) }));
    const matchIds = fixtures.map(item => item.match_id);
    if (options.matchIds && !matchIds.some(id => options.matchIds!.includes(id))) continue;
    const stale = !(Date.parse(quote.expires_at) > (options.now ?? new Date()).getTime());
    let state: PendingMatchCheckout["state"] = stale ? "stale" : "verifying";
    if (options.reconcile) {
      const verified = await options.reconcile(row.provider_reference);
      state = verified.status === "successful" ? "successful" : ["failed", "abandoned", "reversed"].includes(verified.status) ? "expired" : verified.checkoutUsable && !stale ? "active" : stale ? "stale" : "verifying";
    }
    result.push({ reference: row.provider_reference, state, ...(state === "active" ? { usableUntil: new Date(Math.min(Date.parse(quote.expires_at), (options.now ?? new Date()).getTime() + 60_000)).toISOString() } : {}), authorizationUrl: state === "active" ? safePaystackCheckoutUrl(row.authorization_url) : null, matchIds, fixtures, totalPesewas: quote.total_pesewas });
  }
  for (const row of legacy.data ?? []) {
    const product = row.prediction_access_products as unknown as { prediction_access_product_matches: { match_id: string }[] };
    result.push({ reference: row.provider_reference, authorizationUrl: null, matchIds: product.prediction_access_product_matches.map(item => item.match_id), fixtures: [], totalPesewas: row.currency === "GHS" ? Math.round(Number(row.amount) * 100) : null });
  }
  return result;
}

