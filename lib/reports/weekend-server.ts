import "server-only";
import {completedFixturesSchema,type CompletedFixture} from "./weekend-contract";
import {officialPerformanceSchema} from "./performance-contract";
import {freePrematchSchema} from "../predictive-compass/free";
import {footballHistoricalMatchSchema} from "../predictive-compass/schema";
import {normalizeFixtureTeamMetadata} from "../teams/identity";
import {fixtureDate,latestWeekend,makeWeekendReport,projectWeekendMatch,sameFixture,validRange,type DateRange} from "./weekend";
import {getCustomerAccess} from "../auth/access";
import {hasPredictionAccess} from "../auth/match-access";
import {createCustomerAuthServerClient} from "../supabase/auth-server";

export class WeekendUnavailable extends Error {constructor(){super("Weekend reports are temporarily unavailable. Please try again shortly.");}}
type Options={fetch?:typeof fetch;baseUrl?:string;apiKey?:string;now?:Date;canReadPremium?:(matchId:string)=>Promise<boolean>};
export async function loadWeekendReport(requested:DateRange|null,options:Options={}) {
 const base=options.baseUrl??process.env.PREDICTIVE_COMPASS_CORE_URL,key=options.apiKey??process.env.PREDICTIVE_COMPASS_FOOTBALL_API_KEY;
 if(!base||!key)throw new WeekendUnavailable();
 // Cache only the service's football data, never access decisions or projected
 // customer responses. Next stores HTTP 200 responses only, keyed by URL and
 // headers (including the server credential), with a bounded five-minute TTL.
 // Page/PDF/social reuse frozen reads; every request still rechecks entitlement.
 const get=async(path:string)=>{const response=await(options.fetch??fetch)(new URL(path,base),{headers:{Accept:"application/json","x-api-key":key},cache:"force-cache",next:{revalidate:300},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new WeekendUnavailable();return response.json();};
 const now=options.now??new Date(),end=now.toISOString().slice(0,10),start=new Date(now.getTime()-30*86400000).toISOString().slice(0,10);
 let range=requested??{from:start,to:end};validRange(range.from,range.to);
 let fixtures:CompletedFixture[];
 try {
  const source=completedFixturesSchema.parse(await get(`/api/v1/domains/football/matches/completed?${new URLSearchParams(range)}`));
  if(source.from!==range.from||source.to!==range.to||source.matches.some(m=>fixtureDate(m.kickoff_at)<range.from||fixtureDate(m.kickoff_at)>range.to))throw new WeekendUnavailable();
  if(!requested)range=latestWeekend(source.matches,now);
  fixtures=source.matches.filter(m=>fixtureDate(m.kickoff_at)>=range.from&&fixtureDate(m.kickoff_at)<=range.to);
 }catch{throw new WeekendUnavailable();}
 let officialUnavailable=false;
 const officialPromise=get(`/api/v1/domains/football/performance/official?${new URLSearchParams(range)}`).then(value=>officialPerformanceSchema.parse(value).records).catch(()=>{officialUnavailable=true;return[];});
 // Resolve payment access once per request; no service identity or paid payload
 // is sent to the browser. The canonical fixture list never depends on access.
 const access=options.canReadPremium?null:await getCustomerAccess();
 const supabase=options.canReadPremium||!access?.customer?null:await createCustomerAuthServerClient();
 const canRead=options.canReadPremium??(async(matchId:string)=>Boolean(access?.customer&&supabase&&await hasPredictionAccess({access,supabase,matchId,stage:"prematch"})));
 const official=await officialPromise;
 const rows=new Array<ReturnType<typeof projectWeekendMatch>>(fixtures.length);let index=0;
 // Bound upstream work. Per-fixture failures retain the authoritative result row.
 async function worker(){while(index<fixtures.length){const current=index++,fixture=fixtures[current];
  const allowed=await canRead(fixture.match_id).catch(()=>false);
  const [freeResult,premiumResult]=await Promise.allSettled([
   fixture.free_prematch_available?get(`/api/v1/domains/football/matches/${fixture.match_id}/free`).then(value=>freePrematchSchema.parse(normalizeFixtureTeamMetadata(value))).then(value=>{if(value.match_id!==fixture.match_id||!sameFixture(value,fixture))throw new WeekendUnavailable();return value;}):Promise.resolve(null),
   allowed&&(fixture.premium_prematch_available||fixture.live_history_available)?get(`/api/v1/domains/football/matches/${fixture.match_id}/prediction`).then(value=>footballHistoricalMatchSchema.parse(normalizeFixtureTeamMetadata(value))).then(value=>{if(value.match_id!==fixture.match_id||!sameFixture(value,fixture)||value.stage!=="FINAL"||!value.current_score||value.current_score.home!==fixture.final_score.home||value.current_score.away!==fixture.final_score.away)throw new WeekendUnavailable();return value.premium_prematch;}):Promise.resolve(null),
  ]);
  rows[current]=projectWeekendMatch(fixture,{allowed,official,free:freeResult.status==="fulfilled"?freeResult.value:null,premium:premiumResult.status==="fulfilled"?premiumResult.value:null,freeError:freeResult.status==="rejected",premiumError:premiumResult.status==="rejected"});
 }}
 await Promise.all([worker(),worker()]);
 const officialRestricted=fixtures.some((fixture,i)=>rows[i].premiumState==="locked"&&official.some(r=>r.settlement&&sameFixture(r,fixture)));
 return makeWeekendReport(range,rows,officialUnavailable,officialRestricted);
}
