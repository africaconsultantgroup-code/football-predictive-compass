import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createFootballCoreClient } from "./server";
import { premiumIntelligenceFixture } from "./premium.fixture";

const matchId = `fm_${"a".repeat(32)}`;
const source = { match_id: matchId, prediction_id: "stored", competition: "Premier League", competition_code: "premier-league", market_scope: "REGULATION_TIME_90_MINUTES", home_team: "Home FC", away_team: "Away FC", kickoff_at: "2026-10-10T14:00:00Z", stage: "PREMATCH", predicted_outcome: "home_win", predicted_score: null, probabilities: { home_win: 58, draw: 25, away_win: 17 }, reliability: { label: "Moderate", score: 65 }, verification_status: "verified", important_information_pending: false, customer_summary: "not-forwarded", customer_key_factors: [], generated_at: null, updated_at: null, evidence_cutoff_at: null, last_intelligence_refresh_at: null, refresh_reason: null, premium_intelligence: premiumIntelligenceFixture };
function client(value: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(Response.json(value, { status }));
  return { fetch, api: createFootballCoreClient({ baseUrl: "https://core.example/", apiKey: "test-server-only-token", fetch }) };
}

describe("Protected approved Premium endpoint", () => {
  it("requests the exact endpoint with a server-only key and projects only safe fields", async () => {
    const { api, fetch } = client({ ...source, shadow: "private", world_state: "private", weights: "private" });
    const response = await api.getPremiumFootballPrediction("stored", matchId);
    expect(fetch).toHaveBeenCalledWith(new URL("https://core.example/api/v1/domains/football/predictions/stored"), expect.objectContaining({ method: "GET", cache: "no-store", headers: { Accept: "application/json", "x-api-key": "test-server-only-token" } }));
    expect(response.premium_intelligence).toEqual(premiumIntelligenceFixture);
    expect(JSON.stringify(response)).not.toMatch(/private|not-forwarded|test-server-only-token|prediction_id|evidence_cutoff_at|refresh_reason/);
  });
  it.each([
    { ...source, prediction_id: "other" }, { ...source, match_id: `fm_${"b".repeat(32)}` },
    { ...source, stage: "HALFTIME" }, { ...source, premium_intelligence: undefined },
    { ...source, premium_intelligence: { ...premiumIntelligenceFixture, shadow: "private" } },
  ])("fails closed for an unexpected or invalid snapshot", async value => {
    await expect(client(value).api.getPremiumFootballPrediction("stored", matchId)).rejects.toMatchObject({ kind: "malformed" });
  });
  it.each([[401, "unauthorized"], [403, "forbidden"], [404, "unavailable"], [503, "unavailable"]])("preserves upstream failure %s", async (status, kind) => {
    await expect(client({}, status as number).api.getPremiumFootballPrediction("stored", matchId)).rejects.toMatchObject({ kind });
  });
});
