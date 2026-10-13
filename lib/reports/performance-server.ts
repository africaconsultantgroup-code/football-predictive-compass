import "server-only";
import {officialPerformanceSchema,type OfficialPerformance} from "./performance-contract";
import {performanceWindow,summarizePerformance,type PerformancePeriod,type PerformanceReport,type PerformanceMatch} from "./performance";
import {recoverRead,logReadFailure} from "../predictive-compass/read-recovery";

export class PerformanceUnavailable extends Error {constructor(){super("Official performance is temporarily unavailable.");}}
export function projectPerformance(source:OfficialPerformance,window:PerformanceReport["window"]):PerformanceReport {
 // Core owns snapshot eligibility. Customer filters the requested calendar period
 // and presents settled results only; it never re-evaluates READY provenance.
 const matches:PerformanceMatch[]=source.records.filter(row=>{const date=row.kickoff_at?new Date(row.kickoff_at).toISOString().slice(0,10):null;return row.settlement!==null&&date!==null&&date>=window.from&&date<=window.to;}).map(row=>({
  competition:row.competition,homeTeam:row.home_team,awayTeam:row.away_team,kickoffAt:row.kickoff_at!,
  compassPick:row.compass_pick.selection,probability:row.compass_pick.model_probability,strength:row.recommendation_strength.label,
  scoreForecast:row.score_forecast.most_likely_score,actualScore:row.settlement!.actual_score,
  pickCorrect:row.settlement!.compass_pick_correct,exactCorrect:row.settlement!.exact_score_correct,
 })).sort((a,b)=>b.kickoffAt.localeCompare(a.kickoffAt));
 return {window,matches,summary:summarizePerformance(matches)};
}
export async function loadPerformanceReport(period:PerformancePeriod,options:{now?:Date;fetch?:typeof fetch;baseUrl?:string;apiKey?:string}={}):Promise<PerformanceReport>{
 const window=performanceWindow(period,options.now),baseUrl=options.baseUrl??process.env.PREDICTIVE_COMPASS_CORE_URL,apiKey=options.apiKey??process.env.PREDICTIVE_COMPASS_FOOTBALL_API_KEY;
 if(!baseUrl||!apiKey)throw new PerformanceUnavailable();
 try{
  const url=new URL("/api/v1/domains/football/performance/official",baseUrl);url.search=new URLSearchParams({from:window.from,to:window.to}).toString();
  const response=await recoverRead(()=>(options.fetch??fetch)(url,{method:"GET",headers:{Accept:"application/json","x-api-key":apiKey},cache:"no-store",signal:AbortSignal.timeout(20000)}));
  if(!response.ok)throw new PerformanceUnavailable();
  return projectPerformance(officialPerformanceSchema.parse(await response.json()),window);
 }catch{logReadFailure("official_report_unavailable");throw new PerformanceUnavailable();}
}
