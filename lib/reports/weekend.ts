import type {CompletedFixture} from "./weekend-contract";
import type {FreePrematchPrediction} from "../predictive-compass/free";
import type {HistoricalPremium} from "../predictive-compass/historical-contract";
import type {OfficialPerformance} from "./performance-contract";
import {pickOutcome} from "./historical";
import {canonicalTeamIdentity} from "../teams/cache";
import {canonicalCompetition} from "../predictive-compass/inventory";

export const WEEKEND_METHODOLOGY="Free performance uses genuine immutable Free pre-match forecasts. Historical Premium performance includes genuine pre-kickoff Premium forecasts created before the current READY lifecycle. Official Premium performance includes only customer-visible Premium snapshots frozen before kickoff under the current readiness lifecycle.";
export const NO_OFFICIAL="No qualifying T-30 READY settlements yet";
export type DateRange={from:string;to:string};
export const fixtureDate=(timestamp:string)=>new Date(timestamp).toISOString().slice(0,10);
type Score={home:number;away:number};
export type ForecastResult={pick:string;probability:number|null;strength:string|null;score:Score|null;correct:boolean|null;exact:boolean|null};
export type WeekendMatch={competition:string;home:string;away:string;kickoff:string;actual:Score;free:ForecastResult|null;premium:ForecastResult|null;classification:"OFFICIAL_PREMATCH"|"LEGACY_PREMATCH"|null;premiumState:"available"|"locked"|"unavailable";freeError:boolean;premiumError:boolean;historyAvailable:boolean;detailHref:string};
export type CategorySummary={available:number;correct:number;assessed:number;accuracy:number|null;exact:number;exactAssessed:number};
export type WeekendReport={range:DateRange;matches:WeekendMatch[];summary:{completed:number;free:CategorySummary;historical:CategorySummary;official:CategorySummary};restricted:boolean;officialUnavailable:boolean;officialRestricted:boolean;incomplete:boolean};
const day=86400000;
export function validRange(from?:string|null,to?:string|null):DateRange|null {
 if(!from&&!to)return null;
 const valid=(s:string|undefined|null)=>Boolean(s&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
 if(!valid(from)||!valid(to)||to!<from!||(Date.parse(to!)-Date.parse(from!))/day>30)throw new Error("Choose an inclusive date range of 1 to 31 days.");
 return{from:from!,to:to!};
}
export function latestWeekend(fixtures:CompletedFixture[],now=new Date()):DateRange {
 const days=fixtures.map(m=>fixtureDate(m.kickoff_at)).filter(date=>[0,1,6].includes(new Date(date).getUTCDay())).sort();
 const anchor=new Date(days.at(-1)??now.toISOString().slice(0,10));
 const offset=(anchor.getUTCDay()+1)%7;anchor.setUTCDate(anchor.getUTCDate()-offset);
 return{from:anchor.toISOString().slice(0,10),to:new Date(anchor.getTime()+2*day).toISOString().slice(0,10)};
}
const outcome=(s:Score)=>s.home===s.away?"draw":s.home>s.away?"home_win":"away_win";
function result(pick:string,selected:string|undefined,probability:number|null,strength:string|null,score:Score|null,actual:Score):ForecastResult {
 return{pick,probability,strength,score,correct:selected?selected===outcome(actual):null,exact:score?score.home===actual.home&&score.away===actual.away:null};
}
export const sameFixture=(a:{competition:string;home_team:string;away_team:string;kickoff_at:string|null},b:CompletedFixture)=>canonicalCompetition(a.competition)===canonicalCompetition(b.competition)&&canonicalTeamIdentity(a.home_team).canonicalName===canonicalTeamIdentity(b.home_team).canonicalName&&canonicalTeamIdentity(a.away_team).canonicalName===canonicalTeamIdentity(b.away_team).canonicalName&&a.kickoff_at!==null&&Date.parse(a.kickoff_at)===Date.parse(b.kickoff_at);
export function projectWeekendMatch(fixture:CompletedFixture,options:{free:FreePrematchPrediction|null;premium:HistoricalPremium|null;allowed:boolean;official:OfficialPerformance["records"];freeError?:boolean;premiumError?:boolean}):WeekendMatch {
 const {free,premium,allowed}=options,actual=fixture.final_score;
 const official=allowed?options.official.find(r=>r.settlement!==null&&sameFixture(r,fixture)&&r.settlement.actual_score.home===actual.home&&r.settlement.actual_score.away===actual.away):undefined;
 const freeResult=free?.status==="available"&&free.match_id===fixture.match_id&&sameFixture(free,fixture)?result(free.predicted_outcome==="draw"?"Draw":`${free.predicted_outcome==="home_win"?fixture.home_team:fixture.away_team} Win`,free.predicted_outcome,free.probabilities[free.predicted_outcome],null,null,actual):null;
 let premiumResult:ForecastResult|null=null,classification:WeekendMatch["classification"]=null;
 if(official){premiumResult={pick:official.compass_pick.selection,probability:official.compass_pick.model_probability,strength:official.recommendation_strength.label,score:official.settlement!.predicted_score,correct:official.settlement!.compass_pick_correct,exact:official.settlement!.predicted_score?official.settlement!.exact_score_correct:null};classification="OFFICIAL_PREMATCH";}
 else if(allowed&&premium?.access_status==="LEGACY_PREMATCH") {
  classification="LEGACY_PREMATCH";
  if(premium.compass_pick)premiumResult=result(premium.compass_pick.selection,pickOutcome(premium.compass_pick.selection,fixture.home_team,fixture.away_team),premium.compass_pick.model_probability,premium.recommendation_strength?.label??null,premium.score_forecast?.status==="available"?premium.score_forecast.most_likely_score:null,actual);
 }
 return{competition:fixture.competition,home:fixture.home_team,away:fixture.away_team,kickoff:fixture.kickoff_at,actual,free:freeResult,premium:premiumResult,classification,premiumState:!allowed&&fixture.premium_prematch_available?"locked":premiumResult?"available":"unavailable",freeError:options.freeError??false,premiumError:options.premiumError??false,historyAvailable:allowed&&fixture.live_history_available,detailHref:`/matches/${fixture.match_id}`};
}
export function summarizeCategory(forecasts:(ForecastResult|null)[]):CategorySummary {
 const present=forecasts.filter((f):f is ForecastResult=>f!==null),assessed=present.filter(f=>f.correct!==null).length,correct=present.filter(f=>f.correct).length;
 return{available:present.length,correct,assessed,accuracy:assessed?correct/assessed*100:null,exact:present.filter(f=>f.exact).length,exactAssessed:present.filter(f=>f.exact!==null).length};
}
export function makeWeekendReport(range:DateRange,matches:WeekendMatch[],officialUnavailable=false,officialRestricted=false):WeekendReport {
 return{range,matches,summary:{completed:matches.length,free:summarizeCategory(matches.map(m=>m.free)),historical:summarizeCategory(matches.filter(m=>m.classification==="LEGACY_PREMATCH").map(m=>m.premium)),official:summarizeCategory(matches.filter(m=>m.classification==="OFFICIAL_PREMATCH").map(m=>m.premium))},restricted:matches.some(m=>m.premiumState==="locked"),officialUnavailable,officialRestricted,incomplete:officialUnavailable||matches.some(m=>m.freeError||m.premiumError)};
}
export const accuracy=(n:number|null)=>n===null?"No qualifying records":`${n.toFixed(1)}%`;
export const scoreText=(s:Score|null)=>s?`${s.home}-${s.away}`:"Unavailable";
export const correctness=(v:boolean|null)=>v===null?"Unavailable":v?"Correct":"Incorrect";
export function summaryLines(report:WeekendReport):[string,string|number][] {
 const s=report.summary;
 return[["Matches Completed",s.completed],["Free Predictions Available",s.free.available],["Free Picks Correct",s.free.correct],["Free Accuracy",accuracy(s.free.accuracy)],["Historical Premium Predictions",s.historical.available],["Historical Premium Picks Correct",s.historical.correct],["Historical Premium Accuracy",accuracy(s.historical.accuracy)],["Official Premium Predictions",report.officialUnavailable?"Temporarily unavailable":s.official.available],["Official Premium Picks Correct",report.officialUnavailable?"Temporarily unavailable":s.official.correct],["Official Premium Accuracy",report.officialUnavailable?"Temporarily unavailable":s.official.available?accuracy(s.official.accuracy):report.officialRestricted?"Match access required":NO_OFFICIAL],["Exact Scores Correct",`${s.historical.exact+s.official.exact} / ${s.historical.exactAssessed+s.official.exactAssessed} available score forecasts`]];
}
