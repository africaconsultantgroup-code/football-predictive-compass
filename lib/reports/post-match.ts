import "server-only";

import { createHash } from "node:crypto";
import { getServerSupabaseClient } from "../supabase/server";
import { getLiveFootballPrediction, getLiveFootballPredictionHistory } from "../predictive-compass/server";
import type { FootballPredictionHistoryEntry, FootballScore } from "../predictive-compass/schema";

export class ReportAccessError extends Error { constructor(public code:"unauthorized"|"not_final"|"unavailable"){super(code)} }
export type StageReview={stage:"PREMATCH"|"LIVE"|"HALFTIME";snapshot:FootballPredictionHistoryEntry|null;outcomeResult:"CORRECT"|"INCORRECT"|"NOT APPLICABLE";exactResult:"CORRECT"|"INCORRECT"|"NOT APPLICABLE";scoreStrength:number|null;actualRank:number|null;marketResult:"NOT APPLICABLE"};
export type PostMatchReport={reportId:string;matchId:string;competition:string;homeTeam:string;awayTeam:string;kickoffAt:string|null;finalScore:FootballScore;finalStatus:"FINAL";generatedAt:string;purchase:{amount:number;currency:string;stages:string[]}|null;reviews:StageReview[];snapshotTimestamps:string[];summary:string};

export function scoreStrength(probability:number,highest:number){if(!Number.isFinite(probability)||!Number.isFinite(highest)||highest<=0)return null;return Math.round(probability/highest*100)}
export function outcomeForScore(score:FootballScore){return score.home===score.away?"draw":score.home>score.away?"home_win":"away_win"}
export function evaluateOutcome(predicted:string|undefined,actual:FootballScore):StageReview["outcomeResult"]{return !predicted?"NOT APPLICABLE":predicted===outcomeForScore(actual)?"CORRECT":"INCORRECT"}
export function evaluateExact(predicted:FootballScore|null|undefined,actual:FootballScore):StageReview["exactResult"]{return !predicted?"NOT APPLICABLE":predicted.home===actual.home&&predicted.away===actual.away?"CORRECT":"INCORRECT"}
export function safeReportFilename(report:Pick<PostMatchReport,"homeTeam"|"awayTeam"|"kickoffAt">){const clean=(s:string)=>s.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"")||"Team";return `Predictive-Compass-${clean(report.homeTeam)}-v-${clean(report.awayTeam)}-${(report.kickoffAt||new Date().toISOString()).slice(0,10)}.pdf`}

function choose(history:FootballPredictionHistoryEntry[],stage:StageReview["stage"]){const candidates=stage==="LIVE"?history.filter(x=>x.stage==="FIRST_HALF_LIVE"):history.filter(x=>x.stage===stage);return candidates.at(-1)||null}
export async function hasPurchasedMatch(userId:string,matchId:string){const admin=getServerSupabaseClient();const {data,error}=await admin.from("prediction_access_grants").select("id,product_id,prediction_access_products!inner(prediction_stage,prediction_access_product_matches!inner(match_id))").eq("user_id",userId).eq("prediction_access_products.prediction_access_product_matches.match_id",matchId).limit(1);return !error&&Boolean(data?.length)}

export async function listPurchasedMatches(userId:string){
  const admin=getServerSupabaseClient();
  const {data,error}=await admin.from("prediction_access_grants").select("product_id,prediction_access_products!inner(prediction_stage,prediction_access_product_matches(match_id,kickoff_at)),prediction_payments(amount,currency,status)").eq("user_id",userId);
  if(error||!data)return[];
  const rows=data as unknown as Array<{prediction_access_products:{prediction_stage:string;prediction_access_product_matches:{match_id:string;kickoff_at:string}[]};prediction_payments:{amount:number;currency:string;status:string}|null}>;
  const map=new Map<string,{matchId:string;kickoffAt:string;purchasedStages:Set<string>;amount:number|null;currency:string|null}>();
  for(const row of rows)for(const match of row.prediction_access_products.prediction_access_product_matches){
    const item=map.get(match.match_id)||{matchId:match.match_id,kickoffAt:match.kickoff_at,purchasedStages:new Set<string>(),amount:null,currency:null};
    item.purchasedStages.add(row.prediction_access_products.prediction_stage);
    if(row.prediction_payments?.status==="successful"){item.amount=Number(row.prediction_payments.amount);item.currency=row.prediction_payments.currency}
    map.set(match.match_id,item);
  }
  return Promise.all([...map.values()].map(async item=>{
    try{
      const current=await getLiveFootballPrediction(item.matchId);
      return {...item,purchasedStages:[...item.purchasedStages],competition:current.competition,homeTeam:current.home_team,awayTeam:current.away_team,status:current.status,isFinal:current.stage==="FINAL"&&Boolean(current.current_score)&&/(FINAL|FINISH|FULL.?TIME)/i.test(current.status),finalScore:current.current_score};
    }catch{
      return {...item,purchasedStages:[...item.purchasedStages],competition:"",homeTeam:"",awayTeam:"",status:"Unavailable",isFinal:false,finalScore:null};
    }
  }));
}

export async function loadPostMatchReport(userId:string,matchId:string,now=new Date()):Promise<PostMatchReport>{if(!await hasPurchasedMatch(userId,matchId))throw new ReportAccessError("unauthorized");const [current,timeline]=await Promise.all([getLiveFootballPrediction(matchId),getLiveFootballPredictionHistory(matchId)]);if(current.stage!=="FINAL"||!current.current_score||!/(FINAL|FINISH|FULL.?TIME)/i.test(current.status))throw new ReportAccessError("not_final");const history=timeline.history.filter((x):x is FootballPredictionHistoryEntry=>!("locked" in x));const finalScore=current.current_score;const stages:[StageReview["stage"],FootballPredictionHistoryEntry|null][]=[["PREMATCH",choose(history,"PREMATCH")],["LIVE",choose(history,"LIVE")],["HALFTIME",choose(history,"HALFTIME")]];const reviews=stages.map(([stage,snapshot])=>({stage,snapshot,outcomeResult:evaluateOutcome(snapshot?.predicted_outcome,finalScore),exactResult:evaluateExact(snapshot?.predicted_score,finalScore),scoreStrength:snapshot?.predicted_score?100:null,actualRank:snapshot?.predicted_score&&evaluateExact(snapshot.predicted_score,finalScore)==="CORRECT"?1:null,marketResult:"NOT APPLICABLE" as const}));const admin=getServerSupabaseClient();const {data:payments}=await admin.from("prediction_payments").select("amount,currency,prediction_access_products!inner(prediction_stage,prediction_access_product_matches!inner(match_id))").eq("user_id",userId).eq("status","successful").eq("prediction_access_products.prediction_access_product_matches.match_id",matchId);const paid=payments as unknown as {amount:number;currency:string;prediction_access_products:{prediction_stage:string}}[]|null;const winner=outcomeForScore(finalScore)==="draw"?"a draw":outcomeForScore(finalScore)==="home_win"?`${timeline.home_team} winning`:`${timeline.away_team} winning`;const available=reviews.filter(x=>x.snapshot);const summary=available.length?`Predictive Compass recorded ${available.length} historical prediction stage${available.length===1?"":"s"} for this match. The verified match result was ${timeline.home_team} ${finalScore.home}-${finalScore.away} ${timeline.away_team}, with ${winner}.`: `No historical prediction snapshots are available for this completed match. The verified final result is preserved below.`;const timestamps=history.map(x=>x.generated_at).filter((x):x is string=>Boolean(x));return {reportId:`PCR-${current.kickoff_at?.slice(0,4)||now.getUTCFullYear()}-${createHash("sha256").update(matchId+timestamps.join("|")).digest("hex").slice(0,8).toUpperCase()}`,matchId,competition:timeline.competition,homeTeam:timeline.home_team,awayTeam:timeline.away_team,kickoffAt:timeline.kickoff_at,finalScore,finalStatus:"FINAL",generatedAt:now.toISOString(),purchase:paid?.length?{amount:Number(paid[0].amount),currency:paid[0].currency,stages:[...new Set(paid.map(x=>x.prediction_access_products.prediction_stage))]}:null,reviews,snapshotTimestamps:timestamps,summary}}
