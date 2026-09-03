import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { amountToSubunits, createPaystackClient } from "./paystack";

export type PaymentProduct = {
  id: string;
  scope_type: "match" | "kickoff_slot";
  prediction_stage: "prematch" | "live" | "halftime";
  price_amount: string | number | null;
  currency: string;
  is_active: boolean;
  sales_open_at: string | null;
  sales_close_at: string | null;
  prediction_access_product_matches: { match_id: string; kickoff_at: string }[];
};

export function validatePaymentProduct(product: PaymentProduct | null, now = new Date()) {
  if (!product || !product.is_active || product.price_amount === null || product.currency !== "GHS") return false;
  if (!Number.isFinite(Number(product.price_amount)) || Number(product.price_amount) < 20) return false;
  const matches = product.prediction_access_product_matches;
  if (product.scope_type === "match" ? matches.length !== 1 : matches.length < 2) return false;
  if (product.scope_type === "kickoff_slot" && new Set(matches.map((match) => match.kickoff_at)).size !== 1) return false;
  if (product.sales_open_at && new Date(product.sales_open_at) > now) return false;
  if (product.sales_close_at && new Date(product.sales_close_at) <= now) return false;
  if (product.prediction_stage === "prematch" && matches.some((match) => new Date(match.kickoff_at) <= now)) return false;
  return true;
}

export function verifiedTransactionMatches(payment: { id: string; user_id: string; product_id: string; provider_reference: string; amount: string | number; currency: string }, transaction: { reference: string; amount: string | number; currency: string; metadata?: Record<string, unknown> }) {
  const metadata = transaction.metadata ?? {};
  return transaction.reference === payment.provider_reference
    && String(transaction.amount) === amountToSubunits(payment.amount)
    && transaction.currency === payment.currency
    && metadata.payment_id === payment.id
    && metadata.user_id === payment.user_id
    && metadata.product_id === payment.product_id;
}

async function loadProduct(admin: SupabaseClient, productId: string) {
  const { data } = await admin.from("prediction_access_products")
    .select("id, scope_type, prediction_stage, price_amount, currency, is_active, sales_open_at, sales_close_at, prediction_access_product_matches(match_id, kickoff_at)")
    .eq("id", productId).maybeSingle();
  return data as unknown as PaymentProduct | null;
}

export async function initializePredictionPayment({
  admin, paystack, userId, email, productId, callbackOrigin, now = new Date(), hasExistingAccess, lifecycleAllows,
}: {
  admin: SupabaseClient;
  paystack: ReturnType<typeof createPaystackClient>;
  userId: string;
  email: string;
  productId: string;
  callbackOrigin: string;
  now?: Date;
  hasExistingAccess: (product: PaymentProduct) => Promise<boolean>;
  lifecycleAllows: (product: PaymentProduct) => Promise<boolean>;
}) {
  const product = await loadProduct(admin, productId);
  if (!validatePaymentProduct(product, now)) return { error: "PRODUCT_NOT_AVAILABLE" as const };
  if (!await lifecycleAllows(product!)) return { error: "PRODUCT_NOT_AVAILABLE" as const };
  if (await hasExistingAccess(product!)) return { error: "ACCESS_ALREADY_GRANTED" as const };

  const paymentId = randomUUID();
  const reference = `fpc-${randomUUID()}`;
  const snapshot = { id: paymentId, user_id: userId, product_id: productId, provider_reference: reference, amount: product!.price_amount, currency: product!.currency, status: "initialized" };
  const inserted = await admin.from("prediction_payments").insert(snapshot);
  if (inserted.error) return { error: "PAYMENT_INITIALIZATION_FAILED" as const };
  try {
    const checkout = await paystack.initialize({
      email,
      amount: amountToSubunits(product!.price_amount!),
      currency: product!.currency,
      reference,
      callbackUrl: `${callbackOrigin}/payments/paystack/callback`,
      metadata: { payment_id: paymentId, user_id: userId, product_id: productId },
    });
    await admin.from("prediction_payments").update({ status: "pending" }).eq("id", paymentId);
    return { authorizationUrl: checkout.authorization_url as string, reference };
  } catch {
    await admin.from("prediction_payments").update({ status: "failed" }).eq("id", paymentId);
    return { error: "PAYMENT_PROVIDER_UNAVAILABLE" as const };
  }
}

export async function verifyAndFulfillPayment({
  admin, paystack, reference, now = new Date(),
}: { admin: SupabaseClient; paystack: ReturnType<typeof createPaystackClient>; reference: string; now?: Date }) {
  const paymentResult = await admin.from("prediction_payments").select("*").eq("provider_reference", reference).maybeSingle();
  const payment = paymentResult.data;
  if (!payment || paymentResult.error) return { status: "not_found" as const };
  if (payment.status === "successful" && payment.grant_id) return { status: "successful" as const };

  let transaction;
  try { transaction = await paystack.verify(reference); } catch { return { status: "verification_failed" as const }; }
  if (!verifiedTransactionMatches(payment, transaction)) {
    await admin.from("prediction_payments").update({ status: "failed" }).eq("id", payment.id);
    return { status: "mismatch" as const };
  }
  if (transaction.status !== "success") {
    const safeStatus = ["failed", "abandoned", "reversed"].includes(transaction.status) ? transaction.status : "pending";
    await admin.from("prediction_payments").update({ status: safeStatus }).eq("id", payment.id);
    return { status: safeStatus as "failed" | "abandoned" | "reversed" | "pending" };
  }

  const product = await loadProduct(admin, payment.product_id);
  if (!validatePaymentProduct(product, now)) {
    await admin.from("prediction_payments").update({ status: "grant_failed", paid_at: transaction.paid_at ?? now.toISOString() }).eq("id", payment.id);
    return { status: "grant_failed" as const };
  }
  const grantResult = await admin.from("prediction_access_grants")
    .upsert({ user_id: payment.user_id, product_id: payment.product_id }, { onConflict: "user_id,product_id" })
    .select("id").single();
  if (grantResult.error || !grantResult.data) {
    await admin.from("prediction_payments").update({ status: "grant_failed", paid_at: transaction.paid_at ?? now.toISOString() }).eq("id", payment.id);
    return { status: "grant_failed" as const };
  }
  await admin.from("prediction_payments").update({ status: "successful", grant_id: grantResult.data.id, paid_at: transaction.paid_at ?? now.toISOString() }).eq("id", payment.id);
  return { status: "successful" as const };
}

export type RecentPayment = { id: string; name: string; stage: string; amount: number; currency: string; status: string; createdAt: string };

export async function getRecentPayments(supabase: SupabaseClient, userId: string): Promise<RecentPayment[]> {
  const { data, error } = await supabase.from("prediction_payments")
    .select("id, amount, currency, status, created_at, prediction_access_products!inner(name, prediction_stage)")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
  if (error || !data) return [];
  return (data as unknown as Array<{ id: string; amount: number; currency: string; status: string; created_at: string; prediction_access_products: { name: string; prediction_stage: string } }>).map((payment) => ({ id: payment.id, name: payment.prediction_access_products.name, stage: payment.prediction_access_products.prediction_stage, amount: payment.amount, currency: payment.currency, status: payment.status, createdAt: payment.created_at }));
}
