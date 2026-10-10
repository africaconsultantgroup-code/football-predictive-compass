import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ access: vi.fn(), grants: vi.fn(), client: vi.fn(), freshness: vi.fn(), upcoming: vi.fn(), premium: vi.fn() }));
vi.mock("../auth/access", () => ({ getCustomerAccess: mocks.access }));
vi.mock("../auth/match-access", () => ({ hasPredictionAccess: mocks.grants }));
vi.mock("../supabase/auth-server", () => ({ createCustomerAuthServerClient: mocks.client }));
vi.mock("./server", () => {
  class CoreClientError extends Error { constructor(readonly kind: string) { super(kind); } }
  return { CoreClientError, requestPrematchFreshness: mocks.freshness, getUpcomingFootballPredictions: mocks.upcoming, getPremiumFootballPrediction: mocks.premium };
});
import { authorizePremiumMatch, loadPremiumMatch } from "./premium-server";
import { CoreClientError } from "./server";
import { hasSuccessfulPrematchPurchase } from "./premium-purchase";
import { premiumIntelligenceFixture } from "./premium.fixture";

const id = `fm_${"a".repeat(32)}`;
const prediction = { match_id: id, prediction_id: "stored", competition: "Premier League", home_team: "Home", away_team: "Away", kickoff_at: "2026-10-10T14:00:00Z", stage: "PREMATCH", predicted_outcome: "home_win", probabilities: { home_win: 58, draw: 25, away_win: 17 }, predicted_score: null, reliability: { label: "Moderate", score: 65 }, verification_status: "verified", important_information_pending: false, customer_summary: "summary", customer_key_factors: [], generated_at: "2026-10-09T10:00:00Z", updated_at: null };
const freshness = { match_id: id, prediction, freshness_status: "fresh", refresh_status: "not_required", maximum_age_seconds: 600, snapshot_age_seconds: 20 };

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-09T12:00:00Z")); mocks.premium.mockResolvedValue({ premium_intelligence: premiumIntelligenceFixture }); });
afterEach(() => vi.useRealTimers());

describe("Existing premium access and snapshot policy", () => {
  it("does not switch snapshots when the approved Premium contract is malformed", async () => {
    mocks.freshness.mockResolvedValue(freshness);
    mocks.premium.mockRejectedValueOnce(new CoreClientError("malformed"));
    await expect(loadPremiumMatch(id)).rejects.toMatchObject({ kind: "malformed" });
    expect(mocks.upcoming).not.toHaveBeenCalled();
  });
  it("requires authentication before consulting grants", async () => {
    mocks.access.mockResolvedValue({ customer: null });
    expect(await authorizePremiumMatch(id)).toBe("anonymous");
    expect(mocks.grants).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("delegates to the existing match/stage entitlement check", async () => {
    const access = { customer: { id: "user" }, capabilities: new Set() }, client = {};
    mocks.access.mockResolvedValue(access); mocks.client.mockResolvedValue(client);
    mocks.grants.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await authorizePremiumMatch(id)).toBe("locked");
    expect(await authorizePremiumMatch(id)).toBe("entitled");
    expect(mocks.grants).toHaveBeenCalledWith({ access, supabase: client, matchId: id, stage: "prematch" });
  });
  it("uses the current approved paid snapshot and no alternate source", async () => {
    mocks.freshness.mockResolvedValue(freshness);
    expect((await loadPremiumMatch(id))?.premium_intelligence.primary_forecast.probabilities).toEqual(prediction.probabilities);
    expect(mocks.premium).toHaveBeenCalledWith("stored", id);
    expect(mocks.upcoming).not.toHaveBeenCalled();
  });
  it("preserves the existing valid stored fallback after a freshness failure", async () => {
    mocks.freshness.mockRejectedValue(new CoreClientError("unavailable"));
    mocks.upcoming.mockResolvedValue([prediction]);
    expect((await loadPremiumMatch(id))?.premium_intelligence.primary_forecast.probabilities).toEqual(prediction.probabilities);
    expect(mocks.upcoming).toHaveBeenCalledWith({ syncProducts: false });
  });
  it("does not substitute a live or different-match snapshot", async () => {
    mocks.freshness.mockRejectedValue(new CoreClientError("unavailable"));
    mocks.upcoming.mockResolvedValue([{ ...prediction, stage: "HALFTIME" }, { ...prediction, match_id: `fm_${"b".repeat(32)}` }]);
    expect(await loadPremiumMatch(id)).toBeNull();
  });
  it("keeps an owned pre-match snapshot available after kickoff", async () => {
    mocks.freshness.mockResolvedValue({ ...freshness, prediction: { ...prediction, kickoff_at: "2026-10-08T14:00:00Z" }, freshness_status: "frozen" });
    expect((await loadPremiumMatch(id))?.premium_intelligence).toEqual(premiumIntelligenceFixture);
  });
});

describe("Purchased label is evidence, not an access grant", () => {
  function database(data: unknown, error: unknown = null) {
    const builder = { select: vi.fn(), eq: vi.fn(), not: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
    builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder); builder.not.mockReturnValue(builder); builder.limit.mockReturnValue(builder);
    return { builder, client: { from: vi.fn().mockReturnValue(builder) } as unknown as SupabaseClient };
  }
  it("checks real successful fulfilled purchases for this user/match/stage", async () => {
    const { builder, client } = database({ id: "payment" });
    expect(await hasSuccessfulPrematchPurchase(client, "user", id)).toBe(true);
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user");
    expect(builder.eq).toHaveBeenCalledWith("status", "successful");
    expect(builder.eq).toHaveBeenCalledWith("prediction_access_products.prediction_stage", "prematch");
    expect(builder.eq).toHaveBeenCalledWith("prediction_access_products.prediction_access_product_matches.match_id", id);
    expect(builder.not).toHaveBeenCalledWith("grant_id", "is", null);
  });
  it.each([[null, null], [{ id: "payment" }, { message: "unavailable" }], [undefined, null]])("does not invent a purchase on missing/error data", async (data, error) => {
    expect(await hasSuccessfulPrematchPurchase(database(data, error).client, "user", id)).toBe(false);
  });
});
