import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
vi.mock("../predictive-compass/server", () => ({ getUpcomingFootballPredictions: vi.fn(), getLiveFootballPrediction: vi.fn() }));
import { calculateMatchBasketPrice, initializeBasketPayment, verifiedBasketTransaction, verifyBasketPayment, type BasketPayment } from "./basket-service";
import { validateBasket, type BasketFixture, type BasketQuote } from "./match-pricing";
import { createPaystackClient, processPaystackWebhook } from "./paystack";
import { createHmac } from "node:crypto";
const now = new Date("2026-10-08T12:00:00Z");
const fixtures: BasketFixture[] = Array.from({ length: 4 }, (_, i) => ({ match_id: `fm_${i.toString(16).padStart(32,"0")}`, kickoff_at: "2026-10-09T18:00:00.000Z", competition: i % 2 ? "UEFA Champions League" : "EPL", home_team: `Home ${i}`, away_team: `Away ${i}` }));
const quote: BasketQuote = { ...validateBasket(fixtures.map(item => item.match_id), fixtures, new Set(), now), id: "11111111-1111-4111-8111-111111111111", user_id: "customer", expires_at: "2026-10-08T12:10:00Z" };
const payment: BasketPayment = { id: "payment", user_id: "customer", quote_id: quote.id, provider_reference: "fpc-basket-test", status: "pending", authorization_url: "https://checkout.paystack.com/safe" };
function setup(options: { ownership?: string[]; quote?: BasketQuote | null; successful?: boolean; rpcError?: string; existing?: BasketPayment; storedStatus?: string } = {}) {
  const records: Record<string, unknown> = { match_basket_quotes: options.quote === undefined ? quote : options.quote, match_basket_payments: { ...payment, status: options.storedStatus ?? (options.successful ? "successful" : "pending") }, customer_match_entitlements: (options.ownership ?? []).map(match_id => ({ match_id })) };
  const writes = vi.fn();
  const query = (table: string) => {
    let byQuote = false;
    const chain = { select: () => chain, eq: (field: string) => { if (field === "quote_id") byQuote = true; return chain; }, maybeSingle: async () => ({ data: table === "match_basket_payments" && byQuote ? options.existing ?? null : records[table], error: null }), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: records[table], error: null }).then(resolve) };
    return { ...chain, insert: async (value: unknown) => { writes(table, value); return { error: null }; }, update: (value: unknown) => { writes(table,value); return chain; } };
  };
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (options.rpcError) return { error: { message: options.rpcError }, data: null };
    if (name === "accept_match_basket") return { error: null, data: { ...payment, id: args.p_payment, provider_reference: args.p_reference } };
    return { error: null, data: args.p_status };
  });
  const admin = { from: query, rpc } as unknown as SupabaseClient;
  const transaction = { reference: payment.provider_reference, amount: 2700, currency: "GHS", status: "success", paid_at: now.toISOString(), metadata: { payment_id: payment.id, user_id: payment.user_id, quote_id: quote.id, pricing_policy: quote.policy_version }, shadow_probabilities: { home:99 } };
  const initialize = vi.fn(async (args: { reference: string }) => ({ authorization_url: payment.authorization_url, reference: args.reference }));
  const verify = vi.fn().mockResolvedValue(transaction);
  const paystack = { initialize, verify } as unknown as ReturnType<typeof createPaystackClient>;
  return { admin, rpc, writes, paystack, initialize, verify, transaction, catalog: async () => fixtures };
}
describe("basket checkout and fulfillment", () => {
  it("never resurrects a terminal payment when a later provider read is unresolved", async () => {
    const s = setup({ storedStatus: "failed" }); s.verify.mockResolvedValueOnce({ ...s.transaction, status: "pending" });
    expect((await verifyBasketPayment({ ...s, reference: payment.provider_reference })).status).toBe("verification_failed");
    expect(s.rpc).not.toHaveBeenCalled(); expect(s.initialize).not.toHaveBeenCalled();
  });
  it.each([800,1500,2100,2700,3300,3900,4500,5100,5700,6300].map((total,index)=>[index+1,total]))("sends exact stored total for %i matches", async (count,total) => {
    const catalog = Array.from({length:count},(_,i)=>({...fixtures[0],match_id:`fm_${i.toString(16).padStart(32,"0")}`}));
    const q = {...quote,...validateBasket(catalog.map(f=>f.match_id),catalog,new Set(),now)};
    const s = setup({quote:q});
    await initializeBasketPayment({...s,catalog:async()=>catalog,quoteId:q.id,userId:q.user_id,email:"unit@example.invalid",callbackOrigin:"https://customer.example",now});
    expect(s.initialize).toHaveBeenCalledOnce();
    expect(s.initialize).toHaveBeenCalledWith(expect.objectContaining({amount:String(total),currency:"GHS"}));
  });
  it("verifies a previously accepted old quote at its original amount without repricing", async () => {
    const old = {...quote,policy_version:"daily-match-v2",unit_pesewas:1600,total_pesewas:6400,regular_pesewas:8000,discount_pesewas:1600};
    const s=setup({quote:old});
    s.verify.mockResolvedValue({...s.transaction,amount:6400,metadata:{...s.transaction.metadata,pricing_policy:old.policy_version}});
    expect((await verifyBasketPayment({...s,reference:payment.provider_reference})).status).toBe("successful");
    expect(old.total_pesewas).toBe(6400);
  });
  it("rejects old pricing before provider initialization", async () => {
    const s=setup({quote:{...quote,policy_version:"daily-match-v2",total_pesewas:6400}});
    await expect(initializeBasketPayment({...s,quoteId:quote.id,userId:quote.user_id,email:"unit@example.invalid",callbackOrigin:"https://customer.example",now})).rejects.toThrow("BASKET_CHANGED_CONFIRM_AGAIN");
    expect(s.initialize).not.toHaveBeenCalled(); expect(s.rpc).not.toHaveBeenCalled();
  });
  it("persists safe exact IDs, tier, quote, and integer amount before payment", async () => {
    const s = setup();
    const saved = await calculateMatchBasketPrice({ ...s, matchIds: fixtures.map(item => item.match_id), userId: "customer", now });
    expect(s.writes).toHaveBeenCalledWith("match_basket_quotes", saved);
    expect(saved).toMatchObject({ total_pesewas: 2700, tier: 4, match_count: 4 });
    expect(JSON.stringify(saved)).not.toMatch(/shadow|probabilit|world_state|research/i);
  });
  it("initializes exactly one GH27 transaction with 2700 pesewas", async () => {
    const s = setup();
    await initializeBasketPayment({ ...s, quoteId: quote.id, userId: "customer", email: "customer@example.test", callbackOrigin: "https://example.test", now });
    expect(s.initialize).toHaveBeenCalledOnce();
    expect(s.initialize).toHaveBeenCalledWith(expect.objectContaining({ amount: "2700", currency: "GHS", metadata: expect.objectContaining({ quote_id: quote.id, user_id: "customer" }) }));
    expect(s.rpc).toHaveBeenCalledWith("accept_match_basket", expect.objectContaining({ p_user: "customer", p_quote: quote.id }));
  });
  it("does not initialize a concurrent overlapping basket", async () => {
    const s = setup({ rpcError: "CHECKOUT_ALREADY_PENDING" });
    await expect(initializeBasketPayment({ ...s, quoteId: quote.id, userId: "customer", email: "a@b.test", callbackOrigin: "https://example.test", now })).rejects.toThrow("CHECKOUT_ALREADY_PENDING");
    expect(s.initialize).not.toHaveBeenCalled();
  });
  it("resumes the same accepted quote without a second initialization", async () => {
    const s = setup(); s.rpc.mockResolvedValueOnce({ data: payment, error: null });
    s.verify.mockResolvedValueOnce({ ...s.transaction, status: "pending" });
    expect(await initializeBasketPayment({ ...s, quoteId: quote.id, userId: "customer", email: "a@b.test", callbackOrigin: "https://example.test", now })).toMatchObject({ reference: payment.provider_reference });
    expect(s.initialize).not.toHaveBeenCalled();
  });
  it("requires reconciliation for an expired quote even when a stored pending URL exists", async () => {
    const s = setup({ existing: payment });
    s.verify.mockResolvedValueOnce({ ...s.transaction, status: "pending" });
    const catalog = vi.fn().mockRejectedValue(new Error("Core outage"));
    await expect(initializeBasketPayment({ ...s, catalog, quoteId: quote.id, userId: "customer", email: "a@b.test", callbackOrigin: "https://example.test", now: new Date("2026-10-10T20:00:00Z") })).rejects.toThrow("CHECKOUT_VERIFICATION_REQUIRED");
    expect(s.initialize).not.toHaveBeenCalled(); expect(s.rpc).toHaveBeenCalledWith("finish_match_basket", expect.objectContaining({ p_status: "pending" })); expect(catalog).not.toHaveBeenCalled();
  });
  it.each([{ ...payment, status: "initialized", authorization_url: null }, { ...payment, authorization_url: "https://checkout.paystack.com.evil.test/unsafe" }, { ...payment, status: "grant_failed" }])("requires verification for unresolved or unsafe existing checkout", async existing => {
    const s = setup({ existing });
    s.verify.mockResolvedValueOnce({ ...s.transaction, status: "pending" });
    await expect(initializeBasketPayment({ ...s, quoteId: quote.id, userId: "customer", email: "a@b.test", callbackOrigin: "https://example.test", now })).rejects.toThrow("CHECKOUT_VERIFICATION_REQUIRED");
    expect(s.initialize).not.toHaveBeenCalled(); expect(s.rpc).not.toHaveBeenCalledWith("accept_match_basket", expect.anything());
  });
  it("does not release a reservation after ambiguous initialization timeout", async () => {
    const s = setup(); s.initialize.mockRejectedValueOnce(new Error("timeout"));
    await expect(initializeBasketPayment({ ...s, quoteId: quote.id, userId: "customer", email: "a@b.test", callbackOrigin: "https://example.test", now })).rejects.toThrow("CHECKOUT_VERIFICATION_REQUIRED");
    expect(s.rpc).toHaveBeenCalledTimes(1);
  });
  it("prevents initialization of a quote owned by another customer", async () => {
    const s = setup({ quote: null });
    await expect(initializeBasketPayment({ ...s, quoteId: quote.id, userId: "another-customer", email: "a@b.test", callbackOrigin: "https://example.test", now })).rejects.toThrow("QUOTE_NOT_FOUND");
    expect(s.initialize).not.toHaveBeenCalled();
  });
  it("does not initialize an owned match", async () => {
    const s = setup({ ownership: [fixtures[0].match_id] });
    await expect(initializeBasketPayment({ ...s, quoteId: quote.id, userId: "customer", email: "a@b.test", callbackOrigin: "https://example.test", now })).rejects.toThrow("ACCESS_ALREADY_GRANTED");
    expect(s.initialize).not.toHaveBeenCalled();
  });
  it("does not initialize an expired quote", async () => {
    const s = setup();
    await expect(initializeBasketPayment({ ...s, quoteId: quote.id, userId: "customer", email: "a@b.test", callbackOrigin: "https://example.test", now: new Date(quote.expires_at) })).rejects.toThrow("QUOTE_EXPIRED");
    expect(s.initialize).not.toHaveBeenCalled();
  });
  it("grants only after reference/amount/currency/metadata verification", async () => {
    const s = setup();
    expect(await verifyBasketPayment({ ...s, reference: payment.provider_reference })).toEqual({ status: "successful" });
    expect(s.rpc).toHaveBeenCalledWith("finish_match_basket", { p_payment: payment.id, p_status: "successful", p_paid_at: now.toISOString() });
  });
  it.each(["reference","amount","currency","metadata"])("rejects tampered %s", async field => {
    const s = setup(); s.verify.mockResolvedValueOnce({ ...s.transaction, [field]: field === "metadata" ? { ...s.transaction.metadata, user_id: "other" } : "wrong" });
    expect((await verifyBasketPayment({ ...s, reference: payment.provider_reference })).status).toBe("mismatch");
    expect(s.rpc).not.toHaveBeenCalledWith("finish_match_basket", expect.objectContaining({ p_status: "successful" }));
  });
  it.each(["failed","abandoned","reversed","pending"])("does not grant %s payments", async status => {
    const s = setup(); s.verify.mockResolvedValueOnce({ ...s.transaction, status });
    expect((await verifyBasketPayment({ ...s, reference: payment.provider_reference })).status).toBe(status);
    expect(s.rpc).toHaveBeenCalledWith("finish_match_basket", expect.objectContaining({ p_status: status }));
  });
  it("does not repeat grants or provider calls on successful replay", async () => {
    const s = setup({ successful: true });
    expect((await verifyBasketPayment({ ...s, reference: payment.provider_reference })).status).toBe("successful");
    expect(s.verify).not.toHaveBeenCalled(); expect(s.rpc).not.toHaveBeenCalled();
  });
  it("holds changed fixtures for reconciliation instead of silently changing a paid basket", async () => {
    const s = setup();
    expect((await verifyBasketPayment({ ...s, catalog: async () => fixtures.map(item => ({ ...item, kickoff_at: "2026-10-10T18:00:00.000Z" })), reference: payment.provider_reference })).status).toBe("grant_failed");
    expect(s.rpc).not.toHaveBeenCalledWith("finish_match_basket", expect.objectContaining({ p_status: "successful" }));
  });
  it("retries fulfillment when storage or fixture verification is unavailable", async () => {
    const s = setup({ rpcError: "database unavailable" });
    expect((await verifyBasketPayment({ ...s, reference: payment.provider_reference })).status).toBe("verification_failed");
  });
  it("uses signed webhook processing without selecting provider/shadow objects", async () => {
    const s = setup(), raw = JSON.stringify({ event: "charge.success", data: { reference: payment.provider_reference, shadow_forecast_id: "never-select" } }), secret = "unit-test-only";
    const fulfill = vi.fn((reference: string) => verifyBasketPayment({ ...s, reference }));
    expect(await processPaystackWebhook(raw, createHmac("sha512", secret).update(raw).digest("hex"), secret, fulfill)).toEqual({ accepted: true });
    expect(await processPaystackWebhook(raw, "invalid", secret, fulfill)).toEqual({ accepted: false });
    expect(fulfill).toHaveBeenCalledOnce();
  });
  it("rejects internal data as authoritative payment metadata", () => {
    const s = setup(); expect(verifiedBasketTransaction(payment, quote, { ...s.transaction, metadata: { shadow_forecast_id: "internal" } })).toBe(false);
  });
});
