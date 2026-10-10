import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not found"); }, usePathname: () => "/matches", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../customer-shell", () => ({ CustomerShell: ({ children }: { children: React.ReactNode }) => children }));
const mocks = vi.hoisted(() => ({ access: vi.fn(), grants: vi.fn(), client: vi.fn(), freshness: vi.fn(), upcoming: vi.fn(), free: vi.fn(), offers: vi.fn(), purchase: vi.fn(), premium: vi.fn() }));
vi.mock("../../lib/auth/access", () => ({ getCustomerAccess: mocks.access }));
vi.mock("../../lib/auth/match-access", () => ({ hasPredictionAccess: mocks.grants, getPredictionOffers: mocks.offers }));
vi.mock("../../lib/supabase/auth-server", () => ({ createCustomerAuthServerClient: mocks.client }));
vi.mock("../../lib/predictive-compass/free-server", () => ({ getFreePrematchPrediction: mocks.free }));
vi.mock("../../lib/predictive-compass/premium-purchase", () => ({ hasSuccessfulPrematchPurchase: mocks.purchase }));
vi.mock("../../lib/predictive-compass/server", () => {
  class CoreClientError extends Error { constructor(readonly kind: string) { super(kind); } }
  return { CoreClientError, requestPrematchFreshness: mocks.freshness, getUpcomingFootballPredictions: mocks.upcoming, getPremiumFootballPrediction: mocks.premium };
});
import MatchPage from "./[matchId]/page";
import { CoreClientError } from "../../lib/predictive-compass/server";
import { toPremiumCustomerPrediction } from "../../lib/predictive-compass/premium";
import { premiumIntelligenceFixture } from "../../lib/predictive-compass/premium.fixture";

const id = `fm_${"a".repeat(32)}`;
const identity = { match_id: id, competition: "Premier League", home_team: "Home", away_team: "Away", kickoff_at: "2026-10-10T14:00:00Z" };
const prediction = { ...identity, prediction_id: "stored", stage: "PREMATCH", predicted_outcome: "home_win", probabilities: { home_win: 58, draw: 25, away_win: 17 }, predicted_score: null, reliability: { label: "Moderate", score: 65 }, verification_status: "verified", important_information_pending: false, customer_summary: "private-raw", customer_key_factors: [], generated_at: "2026-10-09T10:00:00Z", updated_at: null, world_state: { secret: "private-raw" } };
const free = { ...identity, stage: "PREMATCH", tier: "free", status: "available", predicted_outcome: "home_win", probabilities: { home_win: 50, draw: 32, away_win: 18 }, generated_at: "2026-10-08T10:00:00Z" };
const freshness = { match_id: id, prediction, freshness_status: "fresh", refresh_status: "not_required", maximum_age_seconds: 600, snapshot_age_seconds: 20 };
async function html() { return renderToStaticMarkup(await MatchPage({ params: Promise.resolve({ matchId: id }) })); }

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
  mocks.access.mockResolvedValue({ customer: { id: "user" }, capabilities: new Set() });
  mocks.client.mockResolvedValue({}); mocks.grants.mockResolvedValue(true); mocks.purchase.mockResolvedValue(true);
  mocks.freshness.mockResolvedValue(freshness); mocks.free.mockResolvedValue(free); mocks.upcoming.mockResolvedValue([]);
  mocks.premium.mockResolvedValue(toPremiumCustomerPrediction({ ...prediction, competition_code: "premier-league", market_scope: "REGULATION_TIME_90_MINUTES", evidence_cutoff_at: null, last_intelligence_refresh_at: null, refresh_reason: null, premium_intelligence: premiumIntelligenceFixture }));
  mocks.offers.mockResolvedValue([{ productId: "real", scopeType: "match", name: "Premium", priceAmount: 23, currency: "GHS", matchCount: 1 }]);
});
afterEach(() => vi.useRealTimers());

describe("Actual match page premium branches", () => {
  it("opens owner intelligence without a purchase or checkout", async () => {
    mocks.access.mockResolvedValue({customer:{id:"owner"},owner:true,capabilities:new Set(["football.prematch.full"])});
    const markup=await html();
    expect(markup).toContain("Premium Unlocked");expect(markup).toContain("Compass Pick");expect(markup).toContain("58%");
    expect(markup).not.toContain("Add to Basket");expect(markup).not.toContain("Continue to Payment");expect(markup).not.toContain("Purchased ✓");
    expect(mocks.purchase).not.toHaveBeenCalled();expect(mocks.offers).not.toHaveBeenCalled();
  });
  it("keeps active access and Free when the approved Premium contract cannot be read", async () => {
    mocks.premium.mockRejectedValue(new CoreClientError("malformed"));
    const markup = await html();
    expect(markup).toContain("Purchased ✓"); expect(markup).toContain("No new purchase is required");
    expect(markup).toContain("50%"); expect(markup).not.toContain("58%");
    expect(mocks.offers).not.toHaveBeenCalled();
  });
  it("renders purchased premium and separate free content without checkout or internal data", async () => {
    const markup = await html();
    expect(markup).toContain("Purchased ✓"); expect(markup).toContain("Premium Intelligence Unlocked");
    expect(markup).toContain("58%"); expect(markup).toContain("50%"); expect(markup).toContain("Forecast Change");
    expect(mocks.premium).toHaveBeenCalledWith("stored", id);
    expect(markup).not.toContain("private-raw"); expect(markup).not.toContain("unlock-button");
    expect(mocks.offers).not.toHaveBeenCalled();
  });
  it("renders free only and Pricing V2 checkout when not entitled", async () => {
    mocks.grants.mockResolvedValue(false);
    const markup = await html();
    expect(markup).toContain("50%"); expect(markup).not.toContain("58%");
    expect(markup).toContain("GH₵8"); expect(markup).toContain("Unlock Premium");
    expect(markup).not.toContain("PREMIUM MATCH INTELLIGENCE");
    expect(mocks.purchase).not.toHaveBeenCalled();
    expect(mocks.premium).toHaveBeenCalledWith("stored", id);
  });
  it("does not claim a subscription/grant is a purchase without payment evidence", async () => {
    mocks.purchase.mockResolvedValue(false);
    const markup = await html();
    expect(markup).toContain("Access active"); expect(markup).not.toContain("Purchased ✓");
    expect(markup).not.toContain("unlock-button");
  });
  it("preserves paid state and shows preparing when premium is unavailable", async () => {
    mocks.freshness.mockRejectedValue(new CoreClientError("unavailable"));
    const markup = await html();
    expect(markup).toContain("Premium forecast is being prepared");
    expect(markup).toContain("Premium Intelligence Unlocked"); expect(markup).toContain("Purchased ✓");
    expect(markup).toContain("50%"); expect(markup).not.toContain("What Changed");
    expect(markup).not.toContain("unlock-button");
  });
  it("retains the last valid premium snapshot after a freshness failure", async () => {
    mocks.freshness.mockRejectedValue(new CoreClientError("unavailable")); mocks.upcoming.mockResolvedValue([prediction]);
    expect(await html()).toContain("58%");
  });
  it("does not break premium when free is absent", async () => {
    mocks.free.mockResolvedValue(null);
    const markup = await html();
    expect(markup).toContain("58%"); expect(markup).not.toContain("What Changed");
  });
  it("shows owned stored intelligence after kickoff even when freshness is unavailable", async () => {
    mocks.freshness.mockResolvedValue({ ...freshness, prediction: { ...prediction, kickoff_at: "2026-10-08T14:00:00Z" }, freshness_status: "unavailable" });
    const markup = await html();
    expect(markup).toContain("Compass Pick"); expect(markup).toContain("58%");
    expect(markup).toContain("Why Compass Thinks This"); expect(markup).toContain("Score Forecast");
    expect(markup).not.toContain("Add to Basket");
  });
  it("offers unowned stored Premium after a freshness outage without exposing paid contents", async () => {
    mocks.grants.mockResolvedValue(false); mocks.freshness.mockRejectedValue(new CoreClientError("unavailable")); mocks.upcoming.mockResolvedValue([prediction]);
    const markup = await html();
    expect(markup).toContain("Add to Basket"); expect(markup).toContain("GH₵8"); expect(markup).not.toContain("58%");
  });
  it("retains a usable purchase panel when Free is absent", async () => {
    mocks.grants.mockResolvedValue(false); mocks.free.mockResolvedValue(null);
    const markup = await html();
    expect(markup).toContain("Add to Basket"); expect(markup).toContain("GH₵8");
  });
  it("shows preparing rather than checkout when Premium cannot be read", async () => {
    mocks.grants.mockResolvedValue(false); mocks.premium.mockRejectedValue(new CoreClientError("unavailable"));
    const markup = await html();
    expect(markup).toContain("Premium intelligence being prepared"); expect(markup).not.toContain("Add to Basket");
    expect(markup).not.toContain("Core request failed");
  });
  it("preserves completed-match expiry and checkout delivery protection", async () => {
    mocks.grants.mockResolvedValue(false);
    mocks.freshness.mockResolvedValue({ ...freshness, prediction: { ...prediction, kickoff_at: "2026-10-08T14:00:00Z" }, freshness_status: "frozen" });
    const markup = await html();
    expect(markup).toContain("Kickoff reached");
    expect(markup).not.toContain("58%"); expect(markup).not.toContain("unlock-button");
    expect(mocks.offers).not.toHaveBeenCalled();
  });
});
