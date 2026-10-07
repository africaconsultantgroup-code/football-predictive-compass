import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { compareForecasts, createPremiumMatchHandler, premiumSummary, toPremiumCustomerPrediction } from "../../lib/predictive-compass/premium";
import { createFreePrematchHandler, freePrematchSchema, unavailableFreePrematch } from "../../lib/predictive-compass/free";
import { PremiumMatchExperience, ForecastComparison, ForecastFreshness } from "./premium-components";
import { FreeMatchDetail } from "./free-detail";

const identity = { match_id: `fm_${"a".repeat(32)}`, competition: "Premier League", home_team: "Home FC", away_team: "Away FC", kickoff_at: "2026-10-10T14:00:00Z" };
const source = { ...identity, prediction_id: "existing-premium", stage: "PREMATCH", predicted_outcome: "home_win", probabilities: { home_win: 58, draw: 25, away_win: 17 }, predicted_score: { home: 2, away: 1 }, reliability: { label: "Moderate", score: 65 }, verification_status: "verified", important_information_pending: false, customer_summary: "private-facts", customer_key_factors: ["private-facts"], generated_at: "2026-10-09T10:00:00Z", updated_at: "2026-10-09T10:01:00Z" };
const premium = toPremiumCustomerPrediction(source);
const free = freePrematchSchema.parse({ ...identity, stage: "PREMATCH", tier: "free", status: "available", predicted_outcome: "home_win", probabilities: { home_win: 50, draw: 32, away_win: 18 }, generated_at: "2026-10-08T10:00:00Z" });
const now = new Date("2026-10-09T12:00:00Z");

describe("Premium customer access and data shaping", () => {
  it.each([["anonymous", 401], ["locked", 403]] as const)("denies %s before reading premium data", async (access, status) => {
    const load = vi.fn().mockResolvedValue(premium);
    const response = await createPremiumMatchHandler(async () => access, load)(identity.match_id);
    expect(response.status).toBe(status);
    expect(load).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("58");
  });
  it("returns the purchased customer's premium contract with private no-store caching", async () => {
    const response = await createPremiumMatchHandler(async () => "entitled", async () => premium)(identity.match_id);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(premium);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each(["world_state", "raw_evidence", "correlation_factors", "weights", "policy_id", "research_state", "shadow_probabilities", "shadow_forecast_id", "candidate_policy_version", "experiment_id", "provider_payload", "market_movement", "combined", "champion", "unified", "market", "calibration"])("strips %s from the premium projection", field => {
    const result = toPremiumCustomerPrediction({ ...source, [field]: { private: "secret-data" } });
    expect(result).toEqual(premium);
    expect(JSON.stringify(result)).not.toContain("secret-data");
  });
  it("ignores unsupported reason, recommendation and basic-score inputs", () => {
    const result = toPremiumCustomerPrediction({ ...source, explanation_categories: [{ category: "Team News", text: "confirmed XI" }], compass_pick: { market: "draw_no_bet" }, market_opportunities: [{ market: "Over 1.5" }] });
    expect(result.explanation_categories).toEqual([]);
    expect(result.compass_pick).toBeNull();
    expect(result.market_opportunities).toEqual([]);
    expect(result.score_forecast).toBeNull();
    expect(premiumSummary(result)).not.toContain("private-facts");
  });
  it("cannot leak premium probabilities through the free endpoint", async () => {
    const response = await createFreePrematchHandler(async () => unavailableFreePrematch(source))(identity.match_id);
    expect((await response.json()).probabilities).toBeNull();
    expect((await createFreePrematchHandler(async () => premium)(identity.match_id)).status).toBe(503);
  });
  it("returns preparing without a paid vector when source is missing or malformed", async () => {
    for (const value of [null, { ...premium, shadow: "private" }, { ...premium, match_id: `fm_${"b".repeat(32)}` }]) {
      const response = await createPremiumMatchHandler(async () => "entitled", async () => value)(identity.match_id);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ match_id: identity.match_id, tier: "premium", status: "preparing" });
    }
  });
  it("rejects invalid source distributions and non-pre-match source stages", () => {
    expect(() => toPremiumCustomerPrediction({ ...source, probabilities: { home_win: 90, draw: 25, away_win: 17 } })).toThrow();
    expect(() => toPremiumCustomerPrediction({ ...source, stage: "FINAL" })).toThrow();
  });
});

describe("Stored Free to Premium comparison", () => {
  it("coexists safely and calculates percentage-point changes", () => {
    const comparison = compareForecasts(free, premium, now)!;
    expect(comparison.changes).toEqual({ home_win: 8, draw: -7, away_win: -1 });
    const html = renderToStaticMarkup(<ForecastComparison comparison={comparison} />);
    expect(html).toContain("50%"); expect(html).toContain("58%");
    expect(html).toContain("+8 percentage points");
    expect(html).not.toContain("better");
  });
  it("shows a changed leader without comparing two different outcome probabilities", () => {
    const changed = freePrematchSchema.parse({ ...free, predicted_outcome: "draw", probabilities: { home_win: 30, draw: 45, away_win: 25 } });
    const comparison = compareForecasts(changed, premium, now)!;
    expect(comparison.leading_outcome_changed).toBe(true);
    expect(comparison.changes.home_win).toBe(28);
    const html = renderToStaticMarkup(<ForecastComparison comparison={comparison} />);
    expect(html).toContain("Most likely outcome changed");
    expect(html).toContain("from Draw to Home FC Win");
    expect(html).not.toContain("+13 percentage points");
  });
  it("rounds fractional changes without floating point artifacts", () => {
    const a = freePrematchSchema.parse({ ...free, probabilities: { home_win: 50.12, draw: 31.58, away_win: 18.3 } });
    const b = toPremiumCustomerPrediction({ ...source, probabilities: { home_win: 58.25, draw: 24.65, away_win: 17.1 } });
    expect(compareForecasts(a, b, now)?.changes.home_win).toBe(8.13);
  });
  it.each([
    { match_id: `fm_${"b".repeat(32)}` }, { competition: "UEFA Champions League" }, { home_team: "Different" }, { away_team: "Different" },
    { kickoff_at: "2026-10-11T14:00:00Z" }, { kickoff_at: null }, { generated_at: "2026-10-09T11:00:00Z" },
  ])("hides unsafe identity/time comparisons %j", change => {
    expect(compareForecasts(freePrematchSchema.parse({ ...free, ...change }), premium, now)).toBeNull();
  });
  it("does not use later refresh metadata to pretend an older vector is newer", () => {
    expect(compareForecasts(free, { ...premium, generated_at: "2026-10-07T10:00:00Z", updated_at: "2026-10-09T11:00:00Z" }, now)).toBeNull();
    expect(compareForecasts(free, { ...premium, generated_at: null }, now)).toBeNull();
    expect(compareForecasts(free, { ...premium, generated_at: "2026-10-09T13:00:00Z" }, now)).toBeNull();
    expect(compareForecasts(free, { ...premium, generated_at: "2026-10-10T14:00:00Z" }, new Date("2026-10-11"))).toBeNull();
  });
  it("accepts equivalent kickoff timestamps with different UTC offsets", () => {
    expect(compareForecasts(free, { ...premium, kickoff_at: "2026-10-10T15:00:00+01:00" }, now)).not.toBeNull();
  });
});

describe("Premium experience and checkout states", () => {
  it("shows premium first, preserves free separately and keeps owned checkout absent", () => {
    const html = renderToStaticMarkup(<PremiumMatchExperience prediction={premium} free={free} now={now} />);
    expect(html.indexOf("Premium forecast")).toBeLessThan(html.indexOf("What Changed"));
    expect(html.indexOf("What Changed")).toBeLessThan(html.indexOf("Compass Pick"));
    expect(html.indexOf("Compass Pick")).toBeLessThan(html.indexOf("Why the forecast changed"));
    expect(html).toContain("58%"); expect(html).toContain("50%");
    expect(html).not.toContain("unlock-button");
    expect(html).not.toContain("private-facts");
  });
  it("shows honest empty states and no inferred betting/score products", () => {
    const html = renderToStaticMarkup(<PremiumMatchExperience prediction={premium} free={null} now={now} />);
    expect(html).toContain("Compass Pick not available yet");
    expect(html).toContain("Ranked opportunities are not available yet");
    expect(html).toContain("Advanced score intelligence coming later");
    expect(html).toContain("Specific change reasons are not available");
    expect(html).not.toContain("What Changed");
    expect(html).not.toContain("Draw No Bet");
    expect(html).not.toContain("confirmed XI");
  });
  it("keeps a paid unavailable forecast distinct from a separately displayed free view", () => {
    const html = renderToStaticMarkup(<PremiumMatchExperience prediction={null} free={free} now={now} />);
    expect(html).toContain("Premium forecast is being prepared");
    expect(html).toContain("No new purchase is required");
    expect(html).toContain("FREE PRE-MATCH");
    expect(html).not.toContain("What Changed");
    expect(html.slice(html.indexOf('aria-label="Premium forecast"'), html.indexOf("</section>"))).not.toContain("50%");
  });
  it("shows real offer price and uses existing premium checkout", () => {
    const html = renderToStaticMarkup(<FreeMatchDetail free={free} unlocked={false} deliverable offers={[{ productId: "real-product", scopeType: "match", name: "Premium Pre-Match", currency: "GHS", priceAmount: 23, matchCount: 1 }]} />);
    expect(html).toContain("GH₵23.00");
    expect(html).toContain("Unlock Premium");
    expect(html).not.toContain("58%");
  });
  it("shows supported freshness without inventing a next lineup stage", () => {
    const html = renderToStaticMarkup(<ForecastFreshness prediction={premium} updating now={now} />);
    expect(html).toContain("2026-10-09T10:00:00Z");
    expect(html).toContain("check is underway");
    expect(html).not.toContain("Next update");
  });
});
