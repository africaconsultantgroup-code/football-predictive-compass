import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { upcoming, stored, freeUpcoming } = vi.hoisted(() => ({ upcoming: vi.fn(), stored: vi.fn().mockResolvedValue(null), freeUpcoming: vi.fn() }));
vi.mock("./server", () => ({ getUpcomingFootballPredictions: upcoming, getStoredFreePrematch: stored, getStoredFreeUpcoming: freeUpcoming }));
import { getFreePrematchPrediction, getFreeUpcomingPredictions } from "./free-server";
import { freePrematchSchema } from "./free";

describe("Dedicated free forecast source", () => {
  it("reads identity without product synchronization and never reuses premium probabilities", async () => {
    const match_id = `fm_${"c".repeat(32)}`;
    upcoming.mockResolvedValue([{ match_id, competition: "Premier League", home_team: "Home", away_team: "Away", kickoff_at: "2026-10-10T14:00:00Z", stage: "PREMATCH", probabilities: { home_win: 58, draw: 25, away_win: 17 }, predicted_outcome: "home_win", shadow_probabilities: { home_win: 99 }, customer_summary: "Private" }]);
    const result = await getFreePrematchPrediction(match_id);
    expect(upcoming).toHaveBeenCalledWith({ syncProducts: false });
    expect(result?.status).toBe("unavailable");
    expect(result?.probabilities).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/58|shadow|Private/);
  });
  it("does not relabel live forecasts as free pre-match", async () => {
    const match_id = `fm_${"d".repeat(32)}`;
    upcoming.mockResolvedValue([{ match_id, stage: "HALFTIME" }]);
    expect(await getFreePrematchPrediction(match_id)).toBeNull();
  });
  it("returns a stored free vector without reading premium", async () => {
    upcoming.mockClear();
    const free = freePrematchSchema.parse({ match_id: `fm_${"a".repeat(32)}`, competition: "Premier League", home_team: "Home", away_team: "Away", kickoff_at: "2026-10-10T14:00:00Z", stage: "PREMATCH", tier: "free", status: "available", probabilities: { home_win: 45, draw: 30, away_win: 25 }, predicted_outcome: "home_win", generated_at: "2026-10-08T10:00:00Z" });
    stored.mockResolvedValueOnce(free);
    expect(await getFreePrematchPrediction(free.match_id)).toEqual(free);
    expect(upcoming).not.toHaveBeenCalled();
    freeUpcoming.mockResolvedValueOnce([free]);
    expect(await getFreeUpcomingPredictions()).toEqual([free]);
  });
  it("fails closed on a rescheduled fixture and a free source outage", async () => {
    const identity = { match_id: `fm_${"a".repeat(32)}`, competition: "Premier League", home_team: "Home", away_team: "Away", kickoff_at: "2026-10-12T14:00:00Z" };
    stored.mockResolvedValueOnce({ ...identity, kickoff_at: "2026-10-10T14:00:00Z", status: "available" });
    expect((await getFreePrematchPrediction(identity.match_id, identity))?.status).toBe("unavailable");
    stored.mockRejectedValueOnce(new Error("private"));
    expect((await getFreePrematchPrediction(identity.match_id, identity))?.probabilities).toBeNull();
    freeUpcoming.mockRejectedValueOnce(new Error("private"));
    expect(await getFreeUpcomingPredictions()).toEqual([]);
  });
});
