import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLiveFootballPrediction, getUpcomingFootballPredictions } from "../predictive-compass/server";
import { BasketError, MATCH_PRICING_POLICY, revalidateQuote, validateBasket, type BasketFixture, type BasketQuote } from "./match-pricing";
import type { createPaystackClient } from "./paystack";
import { safePaystackCheckoutUrl } from "./checkout-link";

type Provider = ReturnType<typeof createPaystackClient>;
export type BasketPayment = { id: string; user_id: string; quote_id: string; provider_reference: string; status: string; authorization_url: string | null };
export async function loadBasketCatalog(now = new Date()): Promise<BasketFixture[]> {
  // Read existing customer snapshots only. Never invoke freshness/generation or
  // automatic legacy product synchronization while calculating a price.
  const predictions = await getUpcomingFootballPredictions({ syncProducts: false });
  return predictions.filter(item => item.match_id && item.stage === "PREMATCH" && item.kickoff_at && Date.parse(item.kickoff_at) > now.getTime()).map(item => ({ match_id: item.match_id!, kickoff_at: new Date(item.kickoff_at!).toISOString(), competition: item.competition, home_team: item.home_team, away_team: item.away_team }));
}
export async function ownedMatchIds(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.from("customer_match_entitlements").select("match_id").eq("user_id", userId);
  if (error) throw new BasketError("OWNERSHIP_UNAVAILABLE", 503);
  return new Set<string>((data ?? []).map(item => item.match_id));
}
export async function calculateMatchBasketPrice({ admin, matchIds, userId, catalog = loadBasketCatalog, now = new Date() }: { admin: SupabaseClient; matchIds: string[]; userId: string; catalog?: () => Promise<BasketFixture[]>; now?: Date }): Promise<BasketQuote> {
  const [fixtures, owned] = await Promise.all([catalog(), ownedMatchIds(admin, userId)]);
  const selection = validateBasket(matchIds, fixtures, owned, now);
  const quote = { ...selection, id: randomUUID(), user_id: userId, expires_at: new Date(now.getTime() + MATCH_PRICING_POLICY.quoteLifetimeMs).toISOString() };
  const { error } = await admin.from("match_basket_quotes").insert(quote);
  if (error) throw new BasketError("QUOTE_UNAVAILABLE", 503);
  return quote;
}
async function loadQuote(admin: SupabaseClient, quoteId: string, userId: string) {
  const { data, error } = await admin.from("match_basket_quotes").select("*").eq("id", quoteId).eq("user_id", userId).maybeSingle();
  if (error) throw new BasketError("QUOTE_UNAVAILABLE", 503);
  if (!data) throw new BasketError("QUOTE_NOT_FOUND", 404);
  return data as BasketQuote;
}
export async function initializeBasketPayment({ admin, paystack, quoteId, userId, email, callbackOrigin, catalog = loadBasketCatalog, now = new Date() }: { admin: SupabaseClient; paystack: Provider; quoteId: string; userId: string; email: string; callbackOrigin: string; catalog?: () => Promise<BasketFixture[]>; now?: Date }) {
  const quote = await loadQuote(admin, quoteId, userId);
  const existing = await admin.from("match_basket_payments").select("id,user_id,quote_id,provider_reference,status,authorization_url").eq("quote_id", quoteId).eq("user_id", userId).maybeSingle();
  if (existing.error) throw new BasketError("CHECKOUT_STATUS_UNAVAILABLE", 503);
  if (existing.data) {
    const payment = existing.data as BasketPayment;
    const url = payment.status === "pending" ? safePaystackCheckoutUrl(payment.authorization_url) : null;
    if (url) return { authorizationUrl: url, reference: payment.provider_reference };
    throw new BasketError("CHECKOUT_VERIFICATION_REQUIRED", 409);
  }
  const [fixtures, owned] = await Promise.all([catalog(), ownedMatchIds(admin, userId)]);
  revalidateQuote(quote, fixtures, owned, now);
  const id = randomUUID(), reference = `fpc-basket-${randomUUID()}`;
  const accepted = await admin.rpc("accept_match_basket", { p_user: userId, p_quote: quoteId, p_payment: id, p_reference: reference });
  if (accepted.error) {
    const code = ["QUOTE_EXPIRED", "ACCESS_ALREADY_GRANTED", "CHECKOUT_ALREADY_PENDING"].find(value => accepted.error.message.includes(value));
    throw new BasketError(code ?? "CHECKOUT_UNAVAILABLE", code ? 409 : 503);
  }
  const payment = accepted.data as BasketPayment;
  if (payment.id !== id) {
    const url = payment.status === "pending" ? safePaystackCheckoutUrl(payment.authorization_url) : null;
    if (url) return { authorizationUrl: url, reference: payment.provider_reference };
    throw new BasketError("CHECKOUT_ALREADY_PENDING");
  }
  try {
    const checkout = await paystack.initialize({ email, amount: String(quote.total_pesewas), currency: "GHS", reference, callbackUrl: `${callbackOrigin}/payments/paystack/callback`, metadata: { payment_id: id, user_id: userId, quote_id: quote.id, pricing_policy: quote.policy_version } });
    const url = new URL(checkout.authorization_url);
    if (url.protocol !== "https:" || url.hostname !== "checkout.paystack.com") throw new Error("Invalid checkout URL");
    if (checkout.reference !== reference) throw new Error("Invalid provider reference");
    const updated = await admin.from("match_basket_payments").update({ status: "pending", authorization_url: url.href }).eq("id", id).eq("status", "initialized");
    if (updated.error) throw new Error("Checkout persistence failed");
    return { authorizationUrl: url.href, reference };
  } catch {
    // Initialization can time out after Paystack accepted it. Keep reservation;
    // never create a second reference/charge until verification resolves it.
    throw new BasketError("CHECKOUT_VERIFICATION_REQUIRED", 503);
  }
}
export function verifiedBasketTransaction(payment: BasketPayment, quote: BasketQuote, transaction: { reference: string; amount: unknown; currency: unknown; metadata?: Record<string, unknown> }) {
  const meta = transaction.metadata ?? {};
  return transaction.reference === payment.provider_reference && String(transaction.amount) === String(quote.total_pesewas) && transaction.currency === "GHS" && meta.payment_id === payment.id && meta.user_id === payment.user_id && meta.quote_id === quote.id && meta.pricing_policy === quote.policy_version;
}
export async function verifyBasketPayment({ admin, paystack, reference, catalog }: { admin: SupabaseClient; paystack: Provider; reference: string; catalog?: () => Promise<BasketFixture[]> }) {
  const { data, error } = await admin.from("match_basket_payments").select("*").eq("provider_reference", reference).maybeSingle();
  if (error) return { status: "verification_failed" as const };
  if (!data) return { status: "not_found" as const };
  const payment = data as BasketPayment;
  if (payment.status === "successful") return { status: "successful" as const };
  try {
    const quote = await loadQuote(admin, payment.quote_id, payment.user_id);
    const transaction = await paystack.verify(reference);
    if (!verifiedBasketTransaction(payment, quote, transaction)) {
      await finish(admin, payment.id, "grant_failed");
      return { status: "mismatch" as const };
    }
    if (transaction.status !== "success") {
      const status = ["failed", "abandoned", "reversed"].includes(transaction.status) ? transaction.status : "pending";
      return { status: await finish(admin, payment.id, status) };
    }
    // Read fixture identities even if kickoff has just passed. No time-expiring
    // entitlement and no rejected payment merely because a match started.
    const current = catalog ? await catalog() : await Promise.all(quote.fixtures.map(async item => {
      const match = await getLiveFootballPrediction(item.match_id);
      return { match_id: match.match_id, kickoff_at: match.kickoff_at ? new Date(match.kickoff_at).toISOString() : null, competition: match.competition, home_team: match.home_team, away_team: match.away_team };
    }));
    if (quote.fixtures.some(item => !current.some(candidate => candidate.match_id === item.match_id && candidate.kickoff_at === item.kickoff_at && candidate.competition === item.competition && candidate.home_team === item.home_team && candidate.away_team === item.away_team))) {
      await finish(admin, payment.id, "grant_failed", transaction.paid_at);
      return { status: "grant_failed" as const };
    }
    return { status: await finish(admin, payment.id, "successful", transaction.paid_at) };
  } catch { return { status: "verification_failed" as const }; }
}
async function finish(admin: SupabaseClient, id: string, status: string, paidAt?: string) {
  const result = await admin.rpc("finish_match_basket", { p_payment: id, p_status: status, p_paid_at: paidAt ?? null });
  if (result.error) throw new Error("Payment fulfillment unavailable");
  return result.data as string;
}
