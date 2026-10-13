import {renderToStaticMarkup} from "react-dom/server";
import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("next/server",()=>({connection:async()=>undefined}));
vi.mock("next/navigation",()=>({usePathname:()=>"/matches",useRouter:()=>({push:vi.fn()})}));
const mocks=vi.hoisted(()=>({premium:vi.fn(),free:vi.fn(),access:vi.fn(),client:vi.fn(),allowed:vi.fn(),pending:vi.fn()}));
vi.mock("../../lib/predictive-compass/server",()=>({getUpcomingFootballPredictions:mocks.premium,getStoredFreeUpcoming:mocks.free}));
vi.mock("../../lib/auth/access",()=>({getCustomerAccess:mocks.access}));
vi.mock("../../lib/auth/match-access",()=>({hasPredictionAccess:mocks.allowed}));
vi.mock("../../lib/supabase/auth-server",()=>({createCustomerAuthServerClient:mocks.client}));
vi.mock("../../lib/payments/pending-checkout",()=>({loadPendingMatchCheckouts:mocks.pending}));
import {firstAvailableInventory} from "../../lib/predictive-compass/first-inventory";
import {footballPredictionSchema} from "../../lib/predictive-compass/schema";
import {freePrematchSchema} from "../../lib/predictive-compass/free";
import {MatchesDashboard} from "./dashboard";
import {AvailableMatches,ProgressiveMatchesDashboard} from "./dashboard-stream";
const identity={match_id:`fm_${"a".repeat(32)}`,competition:"Premier League",home_team:"Arsenal",away_team:"Chelsea",kickoff_at:"2026-12-01T15:00:00Z",stage:"PREMATCH" as const};
const free=freePrematchSchema.parse({...identity,tier:"free",status:"available",probabilities:{home_win:45,draw:30,away_win:25},predicted_outcome:"home_win",generated_at:"2026-11-30T10:00:00Z"});
const premium=footballPredictionSchema.parse({...identity,prediction_id:"private-prediction",predicted_outcome:"home_win",predicted_score:null,probabilities:{home_win:58,draw:25,away_win:17},reliability:{score:70,label:"High"},verification_status:"verified",important_information_pending:false,customer_summary:"private paid summary",customer_key_factors:[],generated_at:null,updated_at:null});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return{promise,resolve};}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION","v2");mocks.access.mockResolvedValue({customer:null});mocks.client.mockResolvedValue({});mocks.allowed.mockResolvedValue(false);mocks.pending.mockResolvedValue([]);});
afterEach(()=>vi.unstubAllEnvs());
describe("independent fixture delivery",()=>{
 it("returns healthy Free fixtures without waiting for Premium",async()=>{const stalled=deferred<{predictions:string[]}>();expect(await firstAvailableInventory(stalled.promise,Promise.resolve({predictions:["free"]}))).toEqual({source:"free",predictions:["free"]});});
 it("returns healthy Premium identity without waiting for Free",async()=>{const stalled=deferred<{predictions:string[]}>();expect(await firstAvailableInventory(Promise.resolve({predictions:["premium"]}),stalled.promise)).toEqual({source:"premium",predictions:["premium"]});});
 it("does not let a fast empty or failed source erase healthy fixtures",async()=>{expect((await firstAvailableInventory(Promise.resolve({predictions:[]}),Promise.resolve({predictions:["free"]})))?.source).toBe("free");expect((await firstAvailableInventory(Promise.reject(Error("failed")),Promise.resolve({predictions:["free"]})))?.source).toBe("free");expect(await firstAvailableInventory(Promise.resolve({predictions:[]}),Promise.reject(Error("failed")))).toBeNull();});
 it("early Premium-only identity never substitutes paid probabilities for Free or opens a basket",async()=>{const sources={premium:Promise.resolve({predictions:[premium],failed:false as const,diagnostic:"INVENTORY_AVAILABLE" as const}),free:deferred<Awaited<ReturnType<typeof import("../../lib/predictive-compass/free-server").loadFreeUpcoming>>>().promise};const html=renderToStaticMarkup(await AvailableMatches({filter:"all",sources}));expect(html).toContain("Arsenal");expect(html).toContain("Premium options are loading");expect(html).not.toContain("58%");expect(html).not.toContain("private paid summary");expect(html).not.toContain("Add to Basket");});
 it("returns genuine fixture fallback while Premium is pending and shares access checks",async()=>{
   const stalled=deferred<typeof premium[]>();mocks.premium.mockReturnValue(stalled.promise);mocks.free.mockResolvedValue([free]);
   const node=await ProgressiveMatchesDashboard({filter:"all"});
   const early=renderToStaticMarkup(node.props.fallback);
   expect(early).toContain("45%");expect(early).not.toContain("58%");expect(early).not.toContain("Add to Basket");
   stalled.resolve([premium]);const full=renderToStaticMarkup(await MatchesDashboard(node.props.children.props));
   expect(mocks.access).toHaveBeenCalledTimes(1);expect(mocks.pending).not.toHaveBeenCalled();expect(full).toContain("Add to Basket");
 });
 it("does not hold healthy Premium fixture identity behind a stalled access service",async()=>{
   const access=deferred<{customer:null}>();mocks.access.mockReturnValue(access.promise);mocks.premium.mockResolvedValue([premium]);mocks.free.mockResolvedValue([]);
   const node=await ProgressiveMatchesDashboard({filter:"all"});const early=renderToStaticMarkup(node.props.fallback);
   expect(early).toContain("Arsenal");expect(early).not.toContain("58%");expect(early).not.toContain("private paid summary");expect(early).not.toContain("Add to Basket");
   access.resolve({customer:null});await MatchesDashboard(node.props.children.props);
   expect(mocks.premium).toHaveBeenCalledTimes(1);expect(mocks.premium).toHaveBeenCalledWith({syncProducts:false,retryInventory:false});
 });
 it("replaces the early inventory with the complete, ordered union without duplicate fixtures",async()=>{
   const later={...premium,match_id:`fm_${"b".repeat(32)}`,prediction_id:"later",kickoff_at:"2026-12-02T15:00:00Z",home_team:"Liverpool"};
   const earliest={...free,match_id:`fm_${"c".repeat(32)}`,kickoff_at:"2026-12-01T12:00:00Z",home_team:"Everton"};
   const freeLater={...free,match_id:later.match_id,kickoff_at:later.kickoff_at,home_team:later.home_team};
   const stalled=deferred<typeof premium[]>();mocks.premium.mockReturnValue(stalled.promise);mocks.free.mockResolvedValue([freeLater,free,earliest]);
   const node=await ProgressiveMatchesDashboard({filter:"all"});const early=renderToStaticMarkup(node.props.fallback);
   expect(early.match(/class="matches-row"/g)).toHaveLength(3);
   stalled.resolve([later,premium]);const full=renderToStaticMarkup(await MatchesDashboard(node.props.children.props));
   expect(full.match(/class="matches-row"/g)).toHaveLength(3);
   const ids=[...full.matchAll(/class="matches-row" id="([^"]+)"/g)].map(m=>m[1]);
   expect(ids).toEqual([earliest.match_id,free.match_id,later.match_id]);expect(new Set(ids).size).toBe(3);
   expect(full).not.toContain("private paid summary");expect(full).not.toContain("58%");
 });
 it("keeps healthy fixtures and recovery controls when the secondary inventory rejects",async()=>{
   mocks.premium.mockRejectedValue(Error("Premium unavailable"));mocks.free.mockResolvedValue([free]);
   const node=await ProgressiveMatchesDashboard({filter:"all"});const full=renderToStaticMarkup(await MatchesDashboard(node.props.children.props));
   expect(full.match(/class="matches-row"/g)).toHaveLength(1);expect(full).toContain("Retry fixtures");expect(full).toContain("45%");expect(full).not.toContain("58%");
 });
 it("retains owned access and pending checkout state in the final authorized view",async()=>{
   mocks.access.mockResolvedValue({customer:{id:"test-customer"},capabilities:new Set()});mocks.allowed.mockResolvedValue(true);mocks.premium.mockResolvedValue([premium]);mocks.free.mockResolvedValue([free]);
   const node=await ProgressiveMatchesDashboard({filter:"all"});const full=renderToStaticMarkup(await MatchesDashboard(node.props.children.props));
   expect(mocks.pending).toHaveBeenCalledTimes(1);expect(mocks.allowed).toHaveBeenCalledWith(expect.objectContaining({matchId:free.match_id,stage:"prematch"}));expect(full).toContain("View Match Intelligence");expect(full).not.toContain("Add to Basket");
 });
});
