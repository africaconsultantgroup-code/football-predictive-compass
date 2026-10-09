import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ current:vi.fn(),history:vi.fn(),free:vi.fn(),premium:vi.fn(),admin:vi.fn() }));
vi.mock("../predictive-compass/server", () => ({ getLiveFootballPrediction:mocks.current,getLiveFootballPredictionHistory:mocks.history,getStoredFreeUpcoming:mocks.free,getUpcomingFootballPredictions:mocks.premium }));
vi.mock("../supabase/server", () => ({ getServerSupabaseClient:mocks.admin }));
import { listCustomerMatches } from "./post-match";
const id = `fm_${"a".repeat(32)}`, kickoff = "2026-10-12T15:00:00Z";
function database(owned: unknown[] = []) {
  return { from:(table:string) => {
    const data = table === "prediction_access_grants" ? [{ prediction_access_products:{ prediction_stage:"prematch",prediction_access_product_matches:[{match_id:id,kickoff_at:kickoff}] },prediction_payments:{amount:20,currency:"GHS",status:"successful"} }] : table === "customer_match_entitlements" ? owned : [];
    const chain = {select:()=>chain,eq:()=>chain,lte:()=>chain,order:()=>chain,limit:()=>chain,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data,error:null}).then(resolve)};
    return chain;
  } };
}
beforeEach(() => {vi.clearAllMocks();vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION","");mocks.admin.mockReturnValue(database());mocks.premium.mockResolvedValue([]);mocks.free.mockResolvedValue([]);mocks.history.mockRejectedValue(new Error("unavailable"));});
afterEach(()=>vi.unstubAllEnvs());
describe("My Predictions owns identity independently of forecast delivery",()=>{
  it("resolves a purchased fixture from stored Free identity after the live endpoint fails",async()=>{
    mocks.current.mockRejectedValue(new Error("404"));mocks.free.mockResolvedValue([{match_id:id,home_team:"Arsenal",away_team:"Chelsea",competition:"Premier League",probabilities:{home_win:45}}]);
    const [match]=await listCustomerMatches("owner");
    expect(match.homeTeam).toBe("Arsenal");expect(match.awayTeam).toBe("Chelsea");expect(match.purchased).toBe(true);expect(match.purchasedStages).toEqual(["prematch"]);expect(match.amount).toBe(20);
    expect(match).not.toHaveProperty("probabilities");expect(mocks.premium).toHaveBeenCalledWith({syncProducts:false});
  });
  it("preserves completed readable identity and official result without touching ownership",async()=>{
    mocks.current.mockResolvedValue({home_team:"Lens",away_team:"Sporting CP",competition:"UEFA Champions League",stage:"FINAL",status:"FINAL",current_score:{home:1,away:1}});
    const [match]=await listCustomerMatches("owner");expect(match.homeTeam).toBe("Lens");expect(match.isFinal).toBe(true);expect(match.finalScore).toEqual({home:1,away:1});expect(match.purchased).toBe(true);
  });
  it("uses stored historical identity when both live and upcoming sources are unavailable",async()=>{
    mocks.current.mockRejectedValue(new Error("404"));mocks.history.mockResolvedValue({home_team:"Arsenal",away_team:"Chelsea",competition:"EPL",history:[]});
    const [match]=await listCustomerMatches("owner");expect(match.homeTeam).toBe("Arsenal");expect(match.competition).toBe("Premier League");expect(match.purchased).toBe(true);expect(match.isFinal).toBe(false);
  });
});


describe("immutable purchased fixture identity", () => {
  it("keeps real purchased names readable during a complete Core identity outage without projecting quote internals", async () => {
    vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION", "v2");
    mocks.current.mockRejectedValue(new Error("Core timeout"));
    mocks.admin.mockReturnValue(database([{ match_id: id, kickoff_at: kickoff, match_basket_payments: { match_basket_quotes: { fixtures: [{ match_id: id, kickoff_at: kickoff, home_team: "Arsenal", away_team: "Chelsea", competition: "EPL", shadow: "secret", probabilities: { home_win: 99 } }] } } }]));
    const [match] = await listCustomerMatches("owner");
    expect(match.homeTeam).toBe("Arsenal"); expect(match.awayTeam).toBe("Chelsea"); expect(match.competition).toBe("Premier League");
    expect(match.purchased).toBe(true); expect(mocks.free).not.toHaveBeenCalled();
    expect(JSON.stringify(match)).not.toMatch(/secret|shadow|probabilities|match_basket/);
  });
  it("does not use a stored quote identity whose kickoff no longer matches the owned fixture", async () => {
    vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION", "v2");
    mocks.current.mockRejectedValue(new Error("Core timeout"));
    mocks.admin.mockReturnValue(database([{ match_id: id, kickoff_at: kickoff, match_basket_payments: { match_basket_quotes: { fixtures: [{ match_id: id, kickoff_at: "2026-10-13T15:00:00Z", home_team: "Wrong Home", away_team: "Wrong Away", competition: "EPL" }] } } }]));
    const [match] = await listCustomerMatches("owner");
    expect(match.homeTeam).not.toBe("Wrong Home"); expect(match.purchased).toBe(true);
  });
});
