import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { createPremiumMatchHandler, premiumCustomerSchema, toPremiumCustomerPrediction } from "../../lib/predictive-compass/premium";
import { premiumIntelligenceSchema } from "../../lib/predictive-compass/premium-contract";
import { premiumIntelligenceFixture as intelligence } from "../../lib/predictive-compass/premium.fixture";
import { createFreePrematchHandler, freePrematchSchema, unavailableFreePrematch } from "../../lib/predictive-compass/free";
import { PremiumMatchExperience, ForecastComparison, ForecastFreshness } from "./premium-components";
import { FreeMatchDetail } from "./free-detail";

const identity = { match_id: `fm_${"a".repeat(32)}`, competition: "Premier League", home_team: "Home FC", away_team: "Away FC", kickoff_at: "2026-10-10T14:00:00Z" };
const source = { ...identity, prediction_id: "existing-premium", stage: "PREMATCH", predicted_outcome: "home_win", probabilities: { home_win: 58, draw: 25, away_win: 17 }, predicted_score: { home: 2, away: 1 }, reliability: { label: "Moderate", score: 65 }, verification_status: "verified", important_information_pending: false, customer_summary: "private-facts", customer_key_factors: ["private-facts"], generated_at: "2026-10-09T10:00:00Z", updated_at: "2026-10-09T10:01:00Z", premium_intelligence: intelligence };
Object.assign(source, { competition_code: "premier-league", market_scope: "REGULATION_TIME_90_MINUTES", evidence_cutoff_at: null, last_intelligence_refresh_at: null, refresh_reason: null });
const premium = toPremiumCustomerPrediction(source);
const free = freePrematchSchema.parse({ ...identity, stage: "PREMATCH", tier: "free", status: "available", predicted_outcome: "home_win", probabilities: { home_win: 50, draw: 32, away_win: 18 }, generated_at: "2026-10-08T10:00:00Z" });
const now = new Date("2026-10-09T12:00:00Z");
const render = (value = premium) => renderToStaticMarkup(<PremiumMatchExperience prediction={value} free={free} now={now} />);

describe("Premium access and security projection", () => {
  it.each([["anonymous", 401], ["locked", 403]] as const)("denies %s before loading Premium", async (access, status) => {
    const load = vi.fn().mockResolvedValue(premium);
    const response = await createPremiumMatchHandler(async () => access, load)(identity.match_id);
    expect(response.status).toBe(status); expect(load).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("premium_intelligence");
  });
  it("delivers the exact ten-field DTO privately to entitled customers", async () => {
    const response = await createPremiumMatchHandler(async () => "entitled", async () => premium)(identity.match_id);
    expect(response.status).toBe(200); expect(await response.json()).toEqual(premium);
    expect(Object.keys(premium.premium_intelligence)).toEqual(Object.keys(intelligence));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each(["world_state", "raw_gi", "raw_evidence", "weights", "policy_id", "research_state", "shadow_probabilities", "shadow_forecast_id", "candidate_policy_version", "experiment_id", "provider_payload", "combined", "champion", "unified", "market", "model_id", "internal_prediction_id", "api_key"])("excludes engine envelope %s", field => {
    const result = toPremiumCustomerPrediction({ ...source, [field]: { private: "secret-data" } });
    expect(result).toEqual(premium); expect(JSON.stringify(result)).not.toContain("secret-data");
    expect(render(result)).not.toContain("private-facts");
    expect(result).not.toHaveProperty("prediction_id");
  });
  it.each(Object.keys(intelligence))("rejects extra nested fields in %s", key => {
    const value = structuredClone(intelligence) as unknown as Record<string, unknown>;
    const original = value[key];
    if (Array.isArray(original)) value[key] = [...original, { shadow: "private" }];
    else if (typeof original === "object" && original !== null) value[key] = { ...original, shadow: "private" };
    else value.shadow = "private";
    expect(premiumIntelligenceSchema.safeParse(value).success).toBe(false);
  });
  it("rejects missing required status objects, unknown enums and invented markets", () => {
    expect(premiumIntelligenceSchema.safeParse({ ...intelligence, score_forecast: undefined }).success).toBe(false);
    expect(premiumIntelligenceSchema.safeParse({ ...intelligence, recommendation_strength: { label: "Very High", score: 65 } }).success).toBe(false);
    expect(premiumIntelligenceSchema.safeParse({ ...intelligence, compass_pick: { ...intelligence.compass_pick, market: "Draw No Bet" } }).success).toBe(false);
    expect(premiumIntelligenceSchema.safeParse({ ...intelligence, intelligence_reasons: [{ category: "Raw driver", summary: "private" }] }).success).toBe(false);
  });
  it("keeps Premium out of the Free endpoint", async () => {
    expect((await createFreePrematchHandler(async () => premium)(identity.match_id)).status).toBe(503);
    expect((await (await createFreePrematchHandler(async () => unavailableFreePrematch(source))(identity.match_id)).json()).probabilities).toBeNull();
  });
  it.each([null, { ...premium, shadow: "private" }, { ...premium, match_id: `fm_${"b".repeat(32)}` }])("fails closed for invalid customer data", async value => {
    const response = await createPremiumMatchHandler(async () => "entitled", async () => value)(identity.match_id);
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ match_id: identity.match_id, tier: "premium", status: "preparing" });
  });
  it("rejects invalid primary distributions and non-pre-match stages", () => {
    expect(() => toPremiumCustomerPrediction({ ...source, stage: "FINAL" })).toThrow();
    expect(() => premiumIntelligenceSchema.parse({ ...intelligence, primary_forecast: { ...intelligence.primary_forecast, probabilities: { home_win: 90, draw: 25, away_win: 17 } } })).toThrow();
  });
});

describe("Approved Premium rendering", () => {
  it("renders the primary forecast, exact pick and separate Free without checkout", () => {
    const html = render();
    expect(html).toContain("Home FC Win"); expect(html).toContain("58%"); expect(html).toContain("25%"); expect(html).toContain("17%");
    expect(html).toContain("Home FC to win"); expect(html).toContain("strongest current 1X2 outcome");
    expect(html).toContain("50%"); expect(html).not.toContain("unlock-button");
    expect(html).not.toMatch(/Champion|Unified|Combined|World State|private-facts|existing-premium/);
  });
  it("preserves returned rankings and only presents regulation-time 1X2", () => {
    const reordered = { ...premium, premium_intelligence: { ...intelligence, market_opportunities: [...intelligence.market_opportunities].reverse() } };
    const html = render(reordered); const opportunities = html.slice(html.indexOf("Ranked 1X2 Opportunities"), html.indexOf("Why Compass Thinks This"));
    expect(opportunities.indexOf("Away FC to win")).toBeLessThan(opportunities.indexOf("Home FC to win"));
    expect(opportunities).toContain('value="3"'); expect(opportunities).toContain("Regulation time only");
    expect(html).not.toMatch(/BTTS|Double Chance|Draw No Bet|Asian Handicap|Over\/Under/);
  });
  it("shows exact supplied bookmaker numbers without calculating odds or edge", () => {
    const html = render(); expect(html).toContain("2.17"); expect(html).toContain("46%"); expect(html).toContain("1.72"); expect(html).toContain("+12 pp");
  });
  it("shows actual safe reasons, exact strength and supported score probability", () => {
    const html = render(); expect(html).toContain("Team Strength"); expect(html).toContain(intelligence.intelligence_reasons[0].summary);
    expect(html).toContain("Moderate · 65/100"); expect(html).toContain("Home FC 2–1 Away FC"); expect(html).toContain("Exact-score probability: 14%");
  });
  it("does not invent optional score probability or confidence score", () => {
    const value = premiumCustomerSchema.parse({ ...premium, premium_intelligence: { ...intelligence, score_forecast: { ...intelligence.score_forecast, score_probability: null }, recommendation_strength: { label: "Cautious", score: null } } });
    const html = render(value); expect(html).toContain("Home FC 2–1 Away FC"); expect(html).toContain("Cautious");
    expect(html).not.toContain("Exact-score probability"); expect(html).not.toContain("/100"); expect(html).not.toContain("Alternative scorelines");
  });
  it("renders documented unavailable sections safely", () => {
    const value = premiumCustomerSchema.parse({ ...premium, premium_intelligence: { ...intelligence, bookmaker_comparison: [], intelligence_reasons: [], recommendation_strength: { label: "Unavailable", score: null }, score_forecast: { status: "unavailable", most_likely_score: null, score_probability: null, alternative_scorelines: [] }, generated_at: null, availability: { ...intelligence.availability, bookmaker_comparison: "unavailable", intelligence_reasons: "unavailable", score_forecast: "unavailable" } } });
    const html = render(value); expect(html).toContain("Bookmaker comparison is not available"); expect(html).toContain("Intelligence reasons are unavailable"); expect(html).toContain("Score forecast is unavailable"); expect(html).toContain("Update time unavailable");
    expect(html).not.toContain("14%");
  });
  it("honors unavailable change even with different stored Free and Premium vectors", () => {
    const html = render(); expect(html).not.toContain("Forecast Change"); expect(html).not.toContain("percentage points");
    expect(html).not.toContain("+8"); expect(html).toContain("50%"); expect(html).toContain("58%");
  });
  it("renders a future available change verbatim from the same documented shape", () => {
    const value = premiumCustomerSchema.parse({ ...premium, premium_intelligence: { ...intelligence, availability: { ...intelligence.availability, forecast_change: "available" }, forecast_change: { available: true, free_leading_outcome: "draw", free_probability: 45, premium_leading_outcome: "home_win", premium_probability: 58, probability_point_change: 13, leading_outcome_changed: true, reasons: ["Published match information changed."] } } });
    const html = renderToStaticMarkup(<ForecastComparison prediction={value} />);
    expect(html).toContain("45%"); expect(html).toContain("+13 percentage points"); expect(html).toContain("Published match information changed.");
  });
  it("rejects conflicting availability instead of guessing from null values", () => {
    expect(premiumIntelligenceSchema.safeParse({ ...intelligence, availability: { ...intelligence.availability, forecast_change: "available" } }).success).toBe(false);
    expect(premiumIntelligenceSchema.safeParse({ ...intelligence, availability: { ...intelligence.availability, bookmaker_comparison: "unavailable" } }).success).toBe(false);
  });
  it("keeps the prescribed order for desktop and mobile", () => {
    const html = render(); const headings = ["Premium forecast", "Compass Pick", "Bookmaker vs Compass", "Ranked 1X2 Opportunities", "Why Compass Thinks This", "Recommendation Strength", "Most Likely Score", "Forecast Freshness", "Your Free Pre-Match View"];
    headings.slice(1).forEach((heading, index) => expect(html.indexOf(headings[index])).toBeLessThan(html.indexOf(heading)));
  });
  it("keeps paid preparing separate from genuine Free", () => {
    const html = renderToStaticMarkup(<PremiumMatchExperience prediction={null} free={free} now={now} />);
    expect(html).toContain("No new purchase is required"); expect(html).toContain("FREE PRE-MATCH"); expect(html).not.toContain("Forecast Change");
    expect(html.slice(0, html.indexOf("</section>"))).not.toContain("50%");
  });
  it("preserves the existing real offer and checkout", () => {
    const html = renderToStaticMarkup(<FreeMatchDetail free={free} unlocked={false} deliverable offers={[{ productId: "real-product", scopeType: "match", name: "Premium Pre-Match", currency: "GHS", priceAmount: 23, matchCount: 1 }]} />);
    expect(html).toContain("GH₵23.00"); expect(html).toContain("Unlock Premium"); expect(html).not.toContain("58%");
  });
  it("uses DTO generated_at without inventing a next update", () => {
    const html = renderToStaticMarkup(<ForecastFreshness prediction={premium} updating now={now} />);
    expect(html).toContain("Updated"); expect(html).toContain(intelligence.generated_at!); expect(html).not.toContain("Next update");
  });
});
