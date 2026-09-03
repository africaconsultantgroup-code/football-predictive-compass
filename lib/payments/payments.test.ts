import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { amountToSubunits, createPaystackClient, getPaystackSecretKey, PaystackConfigurationError, processPaystackWebhook, verifyPaystackSignature } from "./paystack";
import { validatePaymentProduct, verifiedTransactionMatches, verifyAndFulfillPayment, type PaymentProduct } from "./service";
import type { SupabaseClient } from "@supabase/supabase-js";

const product: PaymentProduct = {
  id: "11111111-1111-1111-1111-111111111111", scope_type: "match", prediction_stage: "prematch",
  price_amount: "20.00", currency: "GHS", is_active: true, sales_open_at: null,
  sales_close_at: "2026-09-03T14:00:00.000Z",
  prediction_access_product_matches: [{ match_id: `fm_${"a".repeat(32)}`, kickoff_at: "2026-09-03T14:00:00.000Z" }],
};

describe("Paystack payment security", () => {
  it.each([["5.00", "500"], ["0.10", "10"], ["125", "12500"]])("converts %s to exact subunits", (amount, expected) => expect(amountToSubunits(amount)).toBe(expected));
  it("requires a test secret and never accepts a live key", () => {
    expect(() => getPaystackSecretKey({ PAYSTACK_SECRET_KEY: "" })).toThrow(PaystackConfigurationError);
    expect(() => getPaystackSecretKey({ PAYSTACK_SECRET_KEY: "sk_live_private" })).toThrow(PaystackConfigurationError);
    expect(getPaystackSecretKey({ PAYSTACK_SECRET_KEY: "sk_test_private" })).toBe("sk_test_private");
  });
  it("initializes only with backend amount and Ghana channels", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ status: true, data: { authorization_url: "https://checkout.paystack.com/safe", reference: "ref" } }), { status: 200 }));
    await createPaystackClient({ secretKey: "sk_test_private", fetch: fetchMock }).initialize({ email: "a@example.com", amount: "500", currency: "GHS", reference: "ref", callbackUrl: "https://example.com/callback", metadata: {} });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ amount: "500", currency: "GHS", channels: ["card", "mobile_money"] });
    expect(JSON.stringify(body)).not.toContain("sk_test_private");
  });
  it("rejects unavailable, unpriced, and closed products", () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    expect(validatePaymentProduct(product, now)).toBe(true);
    expect(validatePaymentProduct({ ...product, price_amount: null }, now)).toBe(false);
    expect(validatePaymentProduct({ ...product, price_amount: "19.99" }, now)).toBe(false);
    expect(validatePaymentProduct({ ...product, is_active: false }, now)).toBe(false);
    expect(validatePaymentProduct({ ...product, sales_close_at: "2026-09-02T11:00:00.000Z" }, now)).toBe(false);
    expect(validatePaymentProduct(null, now)).toBe(false);
  });
  it("requires reference, amount, currency, customer, payment, and product metadata", () => {
    const payment = { id: "payment", user_id: "user", product_id: "product", provider_reference: "ref", amount: "5.00", currency: "GHS" };
    const transaction = { reference: "ref", amount: 500, currency: "GHS", metadata: { payment_id: "payment", user_id: "user", product_id: "product" } };
    expect(verifiedTransactionMatches(payment, transaction)).toBe(true);
    expect(verifiedTransactionMatches(payment, { ...transaction, amount: 501 })).toBe(false);
    expect(verifiedTransactionMatches(payment, { ...transaction, currency: "NGN" })).toBe(false);
  });
  it("rejects invalid webhook signatures and processes a valid charge once per delivery", async () => {
    const secret = "sk_test_private";
    const body = JSON.stringify({ event: "charge.success", data: { reference: "ref" } });
    const signature = createHmac("sha512", secret).update(body).digest("hex");
    const fulfill = vi.fn().mockResolvedValue(undefined);
    expect(verifyPaystackSignature(body, "0".repeat(128), secret)).toBe(false);
    await expect(processPaystackWebhook(body, signature, secret, fulfill)).resolves.toEqual({ accepted: true });
    expect(fulfill).toHaveBeenCalledWith("ref");
  });
  it("enforces payment and grant idempotency and customer read-only RLS", () => {
    const sql = readFileSync("supabase/migrations/20260901203314_paystack_prediction_payments.sql", "utf8");
    expect(sql).toContain("provider_reference text not null unique");
    expect(sql).toContain("grant_id uuid unique");
    expect(sql).toContain("grant select on table public.prediction_payments to authenticated");
    expect(sql).not.toMatch(/grant (insert|update|delete).*prediction_payments.*authenticated/i);
    const grants = readFileSync("supabase/migrations/20260901201438_match_prediction_access.sql", "utf8");
    expect(grants).toContain("unique (user_id, product_id)");
  });

  it("creates the exact product grant once and is safe on callback/webhook retry", async () => {
    const payment = { id: "payment", user_id: "user", product_id: product.id, provider_reference: "ref", amount: "20.00", currency: "GHS", status: "pending", grant_id: null };
    const grants: Array<{ id: string; user_id: string; product_id: string }> = [];
    const admin = {
      from(table: string) {
        if (table === "prediction_payments") return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: payment, error: null }) }) }),
          update: (values: Record<string, unknown>) => ({ eq: async () => { Object.assign(payment, values); return { error: null }; } }),
        };
        if (table === "prediction_access_products") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: product, error: null }) }) }) };
        if (table === "prediction_access_grants") return {
          upsert: (values: { user_id: string; product_id: string }) => ({ select: () => ({ single: async () => {
            const existing = grants.find((grant) => grant.user_id === values.user_id && grant.product_id === values.product_id);
            const grant = existing ?? { id: "grant", ...values };
            if (!existing) grants.push(grant);
            return { data: grant, error: null };
          } }) }),
        };
        throw new Error("unexpected table");
      },
    } as unknown as SupabaseClient;
    const transaction = { status: "success", reference: "ref", amount: 2000, currency: "GHS", paid_at: "2026-09-02T12:00:00.000Z", metadata: { payment_id: "payment", user_id: "user", product_id: product.id } };
    const paystack = { verify: vi.fn().mockResolvedValue(transaction) } as unknown as ReturnType<typeof createPaystackClient>;
    await expect(verifyAndFulfillPayment({ admin, paystack, reference: "ref", now: new Date("2026-09-02T12:00:00.000Z") })).resolves.toEqual({ status: "successful" });
    await expect(verifyAndFulfillPayment({ admin, paystack, reference: "ref", now: new Date("2026-09-02T12:00:00.000Z") })).resolves.toEqual({ status: "successful" });
    expect(grants).toEqual([{ id: "grant", user_id: "user", product_id: product.id }]);
    expect(paystack.verify).toHaveBeenCalledOnce();
  });

  it.each([
    ["failed", 2000, "GHS", "failed"],
    ["abandoned", 2000, "GHS", "abandoned"],
    ["success", 2001, "GHS", "mismatch"],
    ["success", 2000, "NGN", "mismatch"],
  ])("does not grant for provider state %s, amount %s, currency %s", async (providerStatus, amount, currency, expected) => {
    const payment = { id: "payment", user_id: "user", product_id: product.id, provider_reference: "ref", amount: "20.00", currency: "GHS", status: "pending", grant_id: null };
    const grantUpsert = vi.fn();
    const admin = { from: (table: string) => table === "prediction_payments" ? {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: payment, error: null }) }) }),
      update: (values: Record<string, unknown>) => ({ eq: async () => { Object.assign(payment, values); return { error: null }; } }),
    } : table === "prediction_access_grants" ? { upsert: grantUpsert } : { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: product, error: null }) }) }) } } as unknown as SupabaseClient;
    const paystack = { verify: vi.fn().mockResolvedValue({ status: providerStatus, reference: "ref", amount, currency, metadata: { payment_id: "payment", user_id: "user", product_id: product.id } }) } as unknown as ReturnType<typeof createPaystackClient>;
    await expect(verifyAndFulfillPayment({ admin, paystack, reference: "ref" })).resolves.toEqual({ status: expected });
    expect(grantUpsert).not.toHaveBeenCalled();
  });
});
