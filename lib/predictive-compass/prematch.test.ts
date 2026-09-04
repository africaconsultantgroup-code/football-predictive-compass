import { describe, expect, it } from "vitest";

import { isDeliverablePrematch, paidPrematchSnapshot, toPrematchReadiness } from "./prematch";
import type { FootballPrematchFreshness } from "./schema";

const matchId = `fm_${"a".repeat(32)}`;
const result = (overrides: Partial<FootballPrematchFreshness> = {}): FootballPrematchFreshness => ({
  match_id: matchId,
  freshness_status: "fresh",
  refresh_status: "not_required",
  maximum_age_seconds: 600,
  snapshot_age_seconds: 60,
  prediction: {
    match_id: matchId,
    prediction_id: "version-2",
    competition: "Premier League",
    home_team: "Arsenal",
    away_team: "Chelsea",
    kickoff_at: "2026-09-05T14:00:00.000Z",
    stage: "PREMATCH",
    predicted_outcome: "home_win",
    predicted_score: { home: 2, away: 1 },
    probabilities: { home_win: 52, draw: 27, away_win: 21 },
    reliability: { score: 70, label: "High" },
    verification_status: "verified",
    important_information_pending: false,
    customer_summary: "The home side has the edge.",
    customer_key_factors: ["Recent form"],
    generated_at: "2026-09-04T10:00:00.000Z",
    updated_at: "2026-09-04T11:00:00.000Z",
    last_intelligence_refresh_at: "2026-09-04T11:00:00.000Z",
  },
  ...overrides,
});

const beforeKickoff = new Date("2026-09-04T12:00:00.000Z");

describe("living Prematch access", () => {
  it("keeps a queued stale snapshot deliverable to an existing match grant", () => {
    const stale = result({ freshness_status: "stale", refresh_status: "queued" });
    expect(isDeliverablePrematch(stale, beforeKickoff)).toBe(true);
    expect(paidPrematchSnapshot(stale, beforeKickoff)?.prediction_id).toBe("version-2");
  });

  it("publishes only safe readiness metadata for locked customers", () => {
    const readiness = toPrematchReadiness(result(), beforeKickoff);
    const serialized = JSON.stringify(readiness);
    expect(readiness).toMatchObject({ match_id: matchId, home_team: "Arsenal", deliverable: true });
    expect(serialized).not.toMatch(/prediction_id|predicted_outcome|predicted_score|probabilities|reliability|customer_summary|customer_key_factors/);
  });

  it("blocks checkout at kickoff and for unavailable or wrong-stage snapshots", () => {
    expect(isDeliverablePrematch(result(), new Date("2026-09-05T14:00:00.000Z"))).toBe(false);
    expect(isDeliverablePrematch(result({ freshness_status: "unavailable" }), beforeKickoff)).toBe(false);
    expect(isDeliverablePrematch(result({ prediction: { ...result().prediction, stage: "HALFTIME" } }), beforeKickoff)).toBe(false);
  });

  it("binds delivery to canonical match identity rather than prediction version", () => {
    const first = result({ prediction: { ...result().prediction, prediction_id: "version-1" } });
    const second = result({ prediction: { ...result().prediction, prediction_id: "version-2" } });
    expect(paidPrematchSnapshot(first, beforeKickoff)?.match_id).toBe(matchId);
    expect(paidPrematchSnapshot(second, beforeKickoff)?.match_id).toBe(matchId);
  });
});
