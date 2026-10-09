import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ free: vi.fn(), premium: vi.fn(), history: vi.fn() }));
vi.mock("../predictive-compass/server", () => ({ getStoredFreeUpcoming: mocks.free, getUpcomingFootballPredictions: mocks.premium, getLiveFootballPredictionHistory: mocks.history }));
import { historicalFixtureIdentity, loadFixtureIdentities } from "./fixture-identity";
beforeEach(() => vi.clearAllMocks());
describe("owned fixture metadata read boundary", () => {
  it("resolves names independently of current live prediction and strips forecast objects", async () => {
    mocks.free.mockResolvedValue([{ match_id:"fm_owned", home_team:"Arsenal", away_team:"Chelsea", competition:"EPL", probabilities:{home_win:45}, shadow:"private" }]);
    mocks.premium.mockRejectedValue(new Error("outage"));
    const identities = await loadFixtureIdentities();
    expect(identities.get("fm_owned")).toEqual({homeTeam:"Arsenal",awayTeam:"Chelsea",competition:"Premier League"});
    expect(JSON.stringify([...identities])).not.toMatch(/probabilities|private/);
    expect(mocks.premium).toHaveBeenCalledWith({syncProducts:false});
  });
  it("retains completed identity from the existing stored history endpoint", async () => {
    mocks.history.mockResolvedValue({ home_team:"Lens",away_team:"Sporting CP",competition:"UCL",history:[{probabilities:{home_win:58},shadow:"private"}] });
    expect(await historicalFixtureIdentity("fm_completed")).toEqual({homeTeam:"Lens",awayTeam:"Sporting CP",competition:"UEFA Champions League"});
  });
  it("degrades to a friendly missing identity without deriving names from an ID", async () => {
    mocks.history.mockRejectedValue(new Error("unavailable"));
    expect(await historicalFixtureIdentity("fm_private")).toEqual({homeTeam:"",awayTeam:"",competition:""});
  });
});
