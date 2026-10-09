import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ current: vi.fn(), history: vi.fn(), admin: vi.fn(), access:vi.fn(),customerClient:vi.fn() }));
vi.mock("../predictive-compass/server", () => ({ getLiveFootballPrediction: mocks.current, getLiveFootballPredictionHistory: mocks.history }));
vi.mock("../supabase/server", () => ({ getServerSupabaseClient: mocks.admin }));
vi.mock("../auth/access", async () => ({ ...(await vi.importActual("../auth/access")),getCustomerAccess:mocks.access }));
vi.mock("../supabase/auth-server", () => ({ createCustomerAuthServerClient:mocks.customerClient }));
import { loadPostMatchReport } from "./post-match";
const matchId = `fm_${"a".repeat(32)}`;
const snapshot = { stage: "PREMATCH", minute: null, current_score: null, predicted_outcome: "home_win", predicted_score: null, probabilities: { home_win:58, draw:25, away_win:17 }, reliability: { score:70,label:"High" }, generated_at:"2026-10-01T12:00:00Z", change_reason:"update", change_description:"Stored canonical snapshot" };
function database(owned: boolean, basket = true) {
  return { from: (table: string) => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: owned ? { match_id: matchId, match_basket_payments: basket ? { match_basket_quotes: { fixtures:[{match_id:matchId}],match_count:1,total_pesewas:1600,currency:"GHS" } } : null } : null, error: null }), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "prediction_payments" && owned && !basket ? [{ amount:20,currency:"GHS",prediction_access_products:{prediction_stage:"prematch"} }] : [], error:null }).then(resolve) };
    return chain;
  } };
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION", "v2");
  mocks.access.mockResolvedValue({ customer:null,subscription:null,capabilities:new Set() });
  mocks.customerClient.mockResolvedValue({});
  mocks.current.mockResolvedValue({ match_id:matchId,stage:"FINAL",status:"FINAL",current_score:{home:2,away:1},kickoff_at:"2026-10-01T18:00:00Z" });
  mocks.history.mockResolvedValue({ match_id:matchId,competition:"EPL",home_team:"Home",away_team:"Away",kickoff_at:"2026-10-01T18:00:00Z",history:[snapshot] });
});
afterEach(() => vi.unstubAllEnvs());
describe("Pricing V2 historical report boundary", () => {
  it("keeps final facts free without exposing restricted Premium snapshots", async () => {
    mocks.admin.mockReturnValue(database(false));
    const report = await loadPostMatchReport("free-customer",matchId);
    expect(report.finalScore).toEqual({ home:2,away:1 });
    expect(report.reviews.every(item => item.snapshot === null)).toBe(true);
    expect(report.snapshotTimestamps).toEqual([]);
    expect(JSON.stringify(report)).not.toContain('"home_win":58');
    expect(report.purchase).toBeNull();
  });
  it("preserves all-stage historical review for the owner at the purchased per-match price", async () => {
    mocks.admin.mockReturnValue(database(true));
    const report = await loadPostMatchReport("owner",matchId);
    expect(report.reviews[0].snapshot?.probabilities).toEqual(snapshot.probabilities);
    expect(report.purchase).toEqual({ amount:16,currency:"GHS",stages:["prematch","live","halftime"] });
    expect(report.snapshotTimestamps).toEqual([snapshot.generated_at]);
  });
  it("does not reprice a historical single-match purchase", async () => {
    mocks.admin.mockReturnValue(database(true,false));
    expect((await loadPostMatchReport("owner",matchId)).purchase).toEqual({ amount:20,currency:"GHS",stages:["prematch"] });
  });
  it("preserves an existing Full Access capability without creating new subscriptions", async () => {
    mocks.admin.mockReturnValue(database(false));
    mocks.access.mockResolvedValue({customer:{id:"subscriber",email:null},subscription:{name:"Full Access",endsAt:null},capabilities:new Set(["football.prematch.full","football.live.full"])});
    const report=await loadPostMatchReport("subscriber",matchId);
    expect(report.reviews[0].snapshot?.probabilities).toEqual(snapshot.probabilities);
    expect(report.purchase).toBeNull();
  });
  it("does not authorize a different user through a cached capability", async () => {
    mocks.admin.mockReturnValue(database(false));
    mocks.access.mockResolvedValue({customer:{id:"another-subscriber",email:null},subscription:{name:"Full Access",endsAt:null},capabilities:new Set(["football.prematch.full","football.live.full"])});
    expect((await loadPostMatchReport("free-customer",matchId)).reviews[0].snapshot).toBeNull();
  });
});
