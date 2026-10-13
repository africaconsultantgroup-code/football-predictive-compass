import {describe,it,expect,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {createElement} from "react";
import completed from "./weekend-completed.fixture.json";
import arsenal from "./historical-arsenal.fixture.json";
import villa from "./historical-villa.fixture.json";
import storedForecasts from "./weekend-forecasts.fixture.json";
import {completedFixturesSchema,type CompletedFixture} from "./weekend-contract";
import {historicalPremiumSchema} from "../predictive-compass/historical-contract";
import {officialPerformanceFixture} from "./performance.fixture";
import {projectWeekendMatch,makeWeekendReport,validRange,latestWeekend,NO_OFFICIAL,type DateRange} from "./weekend";
import type {FreePrematchPrediction} from "../predictive-compass/free";
import {freePrematchSchema} from "../predictive-compass/free";
import {normalizeFixtureTeamMetadata} from "../teams/identity";
import {WeekendView} from "../../app/performance/weekend/weekend-view";
import {loadWeekendReport} from "./weekend-server";
vi.mock("server-only",()=>({}));
vi.mock("../auth/access",()=>({getCustomerAccess:vi.fn()}));
vi.mock("../supabase/auth-server",()=>({createCustomerAuthServerClient:vi.fn()}));
vi.mock("../auth/match-access",()=>({hasPredictionAccess:vi.fn()}));
const source=completedFixturesSchema.parse(completed),fixtures=source.matches,range:DateRange={from:source.from,to:source.to};
const premium=historicalPremiumSchema.parse(arsenal.premium_prematch);
function free(f:CompletedFixture,outcome:"home_win"|"draw"|"away_win"="home_win"):FreePrematchPrediction {return{match_id:f.match_id,competition:f.competition,home_team:f.home_team,away_team:f.away_team,kickoff_at:f.kickoff_at,stage:"PREMATCH",tier:"free",status:"available",probabilities:outcome==="home_win"?{home_win:60,draw:25,away_win:15}:outcome==="draw"?{home_win:25,draw:60,away_win:15}:{home_win:15,draw:25,away_win:60},predicted_outcome:outcome,generated_at:"2026-10-09T12:00:00Z"};}
const row=(f=fixtures[0],extra:Partial<Parameters<typeof projectWeekendMatch>[1]>={})=>projectWeekendMatch(f,{free:null,premium:null,allowed:true,official:[],...extra});
describe("complete weekend report",()=>{
 it("evaluates the ten genuine captured fixtures with separate transition-weekend denominators",()=>{
  const rows=fixtures.map(f=>{const stored=storedForecasts.find(s=>s.match_id===f.match_id)!;return row(f,{free:freePrematchSchema.parse(normalizeFixtureTeamMetadata(stored.free)),premium:stored.premium?historicalPremiumSchema.parse(stored.premium):null});});
  const report=makeWeekendReport(range,rows);expect(report.summary.completed).toBe(10);expect(report.summary.free.available).toBe(10);expect(report.summary.historical.available).toBe(5);expect(report.summary.official.available).toBe(0);
 });
 it("strictly parses all ten canonical FINAL fixtures, rejecting unknown fields and duplicates",()=>{expect(fixtures).toHaveLength(10);expect(completedFixturesSchema.safeParse({...completed,internal:true}).success).toBe(false);expect(completedFixturesSchema.safeParse({...completed,matches:[fixtures[0],fixtures[0]]}).success).toBe(false);});
 it("renders all ten fixtures even with neither forecast",()=>{const report=makeWeekendReport(range,fixtures.map(f=>row(f)));const html=renderToStaticMarkup(createElement(WeekendView,{report}));expect(html.match(/class="weekend-match"/g)).toHaveLength(10);for(const f of fixtures){expect(html).toContain(f.home_team);expect(html).toContain(f.away_team);}expect(html).toContain(NO_OFFICIAL);expect(html).not.toContain("0.0% Official");});
 it("keeps Free-only, Premium-only and neither rows",()=>{expect(row(fixtures[0],{free:free(fixtures[0])}).free?.correct).toBe(true);expect(row(fixtures[0],{premium}).premium?.correct).toBe(true);expect(row().free).toBeNull();expect(row().premium).toBeNull();});
 it("evaluates genuine Legacy correct and incorrect independently from Free",()=>{const a=row(fixtures[0],{premium,free:free(fixtures[0],"away_win")});expect(a.premium?.correct).toBe(true);expect(a.free?.correct).toBe(false);const v=fixtures.find(f=>f.home_team==="Aston Villa")!;expect(row(v,{premium:historicalPremiumSchema.parse(villa.premium_prematch)}).premium?.correct).toBe(false);});
 it("uses only official endpoint membership for Official classification and Core settlement correctness",()=>{const official=structuredClone(officialPerformanceFixture);expect(row(fixtures[0],{official:[official],premium}).classification).toBe("OFFICIAL_PREMATCH");official.settlement!.compass_pick_correct=false;expect(row(fixtures[0],{official:[official]}).premium?.correct).toBe(false);const locked={...premium,access_status:"LOCKED_PRE_KICKOFF" as const,official_performance_eligible:true};expect(row(fixtures[0],{premium:locked}).classification).toBeNull();expect(row(fixtures[0],{official:[{...official,settlement:null}]}).classification).toBeNull();});
 it("separates historical and official denominators and exact score hits/misses",()=>{const hit={...premium,score_forecast:{...premium.score_forecast!,most_likely_score:fixtures[0].final_score}};expect(row(fixtures[0],{premium:hit}).premium?.exact).toBe(true);expect(row(fixtures[0],{premium}).premium?.exact).toBe(false);const report=makeWeekendReport(range,[row(fixtures[0],{premium:hit}),row(fixtures[0],{official:[officialPerformanceFixture]})]);expect(report.summary.historical.available).toBe(1);expect(report.summary.official.available).toBe(1);expect(report.summary.historical.exact).toBe(1);expect(report.summary.official.exact).toBe(0);});
 it("never exposes protected Premium through a public projection, even if supplied by a caller",()=>{const m=row(fixtures[0],{premium,official:[officialPerformanceFixture],allowed:false});expect(m.premium).toBeNull();expect(m.classification).toBeNull();expect(m.premiumState).toBe("locked");const html=renderToStaticMarkup(createElement(WeekendView,{report:makeWeekendReport(range,[m])}));expect(html).not.toContain("55.95");expect(html).not.toContain("Arsenal to win");});
 it("validates inclusive date boundaries and selects the represented Saturday–Monday weekend",()=>{expect(validRange("2026-10-10","2026-10-12")).toEqual(range);expect(latestWeekend(fixtures,new Date("2026-10-13"))).toEqual(range);expect(()=>validRange("2026-02-30","2026-03-01")).toThrow();expect(()=>validRange("2026-10-12","2026-10-10")).toThrow();expect(()=>validRange("2026-09-01","2026-10-12")).toThrow();});
 it("does not offer exports while sources are unavailable",()=>{const report=makeWeekendReport(range,[row(fixtures[0],{freeError:true})],true);const html=renderToStaticMarkup(createElement(WeekendView,{report}));expect(html).toContain("temporarily unavailable");expect(html).not.toContain("Download Weekend PDF");expect(html).not.toContain(NO_OFFICIAL);});
});
describe("server source and access enforcement",()=>{
 const options=(mock:typeof fetch)=>({fetch:mock,baseUrl:"https://core.example",apiKey:"test-only",canReadPremium:async()=>false,now:new Date("2026-10-13")});
 const fetcher=()=>vi.fn(async(url:URL|RequestInfo)=>{const path=new URL(String(url));if(path.pathname.endsWith("completed"))return Response.json(source);if(path.pathname.endsWith("official"))return Response.json({domain:"football",metric_source:"official_premium_prematch",records:[]});const fixture=fixtures.find(f=>path.pathname.includes(f.match_id))!;if(path.pathname.endsWith("free"))return Response.json(free(fixture));throw new Error("Paid endpoint must not be called");}) as unknown as typeof fetch;
 it("uses the completed inventory as master and never retrieves paid historical content for unpaid visitors",async()=>{const mock=fetcher(),report=await loadWeekendReport(range,options(mock));expect(report.matches).toHaveLength(10);expect(report.summary.free.available).toBe(10);expect(report.matches.every(m=>m.premium===null)).toBe(true);expect(vi.mocked(mock).mock.calls.some(([u])=>String(u).endsWith("/prediction"))).toBe(false);});
 it("fails safely on malformed master inventory and Core outage",async()=>{for(const value of [{matches:[]},null]){const mock=vi.fn(async()=>{if(value===null)throw new Error("Down");return Response.json(value);}) as unknown as typeof fetch;await expect(loadWeekendReport(range,options(mock))).rejects.toThrow("temporarily unavailable");}});
 it("keeps every fixture on malformed Free responses without inventing forecasts",async()=>{const normal=fetcher(),mock=vi.fn(async(u:URL|RequestInfo,init?:RequestInit)=>String(u).endsWith("/free")?Response.json({bad:true}):normal(u,init)) as unknown as typeof fetch;const report=await loadWeekendReport(range,options(mock));expect(report.matches).toHaveLength(10);expect(report.incomplete).toBe(true);expect(report.summary.free.available).toBe(0);});
 it("loads authorized legacy Premium without applying current readiness and preserves all fixtures",async()=>{const normal=fetcher(),mock=vi.fn(async(u:URL|RequestInfo,init?:RequestInit)=>String(u).endsWith(`${fixtures[0].match_id}/prediction`)?Response.json(arsenal):normal(u,init)) as unknown as typeof fetch;const report=await loadWeekendReport(range,{...options(mock),canReadPremium:async id=>id===fixtures[0].match_id});expect(report.matches[0].premium?.probability).toBe(55.95);expect(report.matches[0].classification).toBe("LEGACY_PREMATCH");expect(report.matches).toHaveLength(10);});
});
