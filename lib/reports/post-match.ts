import "server-only";

import { createHash } from "node:crypto";
import type { FootballPredictionHistoryEntry, FootballScore } from "../predictive-compass/schema";
import { getLiveFootballPrediction, getLiveFootballPredictionHistory } from "../predictive-compass/server";
import { getServerSupabaseClient } from "../supabase/server";

export class ReportAccessError extends Error {
  constructor(public code: "not_final" | "unavailable") { super(code); }
}
export type StageReview={stage:"PREMATCH"|"LIVE"|"HALFTIME";snapshot:FootballPredictionHistoryEntry|null;outcomeResult:"CORRECT"|"INCORRECT"|"NOT APPLICABLE";exactResult:"CORRECT"|"INCORRECT"|"NOT APPLICABLE";scoreStrength:number|null;actualRank:number|null;marketResult:"NOT APPLICABLE"};
export type PostMatchReport={reportId:string;matchId:string;competition:string;homeTeam:string;awayTeam:string;kickoffAt:string|null;finalScore:FootballScore;finalStatus:"FINAL";generatedAt:string;purchase:{amount:number;currency:string;stages:string[]}|null;reviews:StageReview[];snapshotTimestamps:string[];summary:string};
type PaymentSnapshot={amount:number;currency:string;status:string};
type MatchSeed={matchId:string;kickoffAt:string;purchased:boolean;purchasedStages:Set<string>;amount:number|null;currency:string|null};

export function scoreStrength(probability:number,highest:number){if(!Number.isFinite(probability)||!Number.isFinite(highest)||highest<=0)return null;return Math.round(probability/highest*100)}
export function outcomeForScore(score:FootballScore){return score.home===score.away?"draw":score.home>score.away?"home_win":"away_win"}
export function evaluateOutcome(predicted:string|undefined,actual:FootballScore):StageReview["outcomeResult"]{return !predicted?"NOT APPLICABLE":predicted===outcomeForScore(actual)?"CORRECT":"INCORRECT"}
export function evaluateExact(predicted:FootballScore|null|undefined,actual:FootballScore):StageReview["exactResult"]{return !predicted?"NOT APPLICABLE":predicted.home===actual.home&&predicted.away===actual.away?"CORRECT":"INCORRECT"}
export function evaluateMarketSuggestion(suggestion:string|null|undefined,actual:FootballScore):StageReview["outcomeResult"]{if(!suggestion)return "NOT APPLICABLE";const accepted:Record<string,string[]>={home_win:["home_win"],away_win:["away_win"],draw:["draw"],home_or_draw:["home_win","draw"],away_or_draw:["away_win","draw"],home_or_away:["home_win","away_win"]};return accepted[suggestion]?.includes(outcomeForScore(actual))?"CORRECT":"INCORRECT"}
export function evaluateScoreRanking(scorelines:FootballScore[],actual:FootballScore){const index=scorelines.findIndex(score=>score.home===actual.home&&score.away===actual.away),rank=index<0?null:index+1;return{rank,exactHit:rank===1,top3:rank!==null&&rank<=3,top5:rank!==null&&rank<=5}}
export function isAuthoritativeFinal(match:{stage:string;status:string;current_score:FootballScore|null}){return match.stage==="FINAL"&&Boolean(match.current_score)&&/(FINAL|FINISH|FULL.?TIME)/i.test(match.status)}
export function safeReportFilename(report:Pick<PostMatchReport,"homeTeam"|"awayTeam"|"kickoffAt">){const clean=(value:string)=>value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"")||"Team";return `Predictive-Compass-${clean(report.homeTeam)}-v-${clean(report.awayTeam)}-${(report.kickoffAt||new Date().toISOString()).slice(0,10)}.pdf`}

function choose(history:FootballPredictionHistoryEntry[],stage:StageReview["stage"]){const candidates=stage==="LIVE"?history.filter(entry=>entry.stage==="FIRST_HALF_LIVE"||entry.stage==="SECOND_HALF_LIVE"):history.filter(entry=>entry.stage===stage);return candidates.at(-1)||null}
function successfulPayment(value:PaymentSnapshot|PaymentSnapshot[]|null){const payments=Array.isArray(value)?value:value?[value]:[];return payments.find(payment=>payment.status==="successful")||null}

export async function listCustomerMatches(userId:string,now=new Date()){
  const admin=getServerSupabaseClient();
  const [grantResult,membershipResult]=await Promise.all([
    admin.from("prediction_access_grants").select("product_id,prediction_access_products!inner(prediction_stage,prediction_access_product_matches(match_id,kickoff_at)),prediction_payments(amount,currency,status)").eq("user_id",userId),
    admin.from("prediction_access_product_matches").select("match_id,kickoff_at").lte("kickoff_at",now.toISOString()).order("kickoff_at",{ascending:false}).limit(200),
  ]);
  if(grantResult.error||membershipResult.error)return[];
  const grants=grantResult.data as unknown as Array<{prediction_access_products:{prediction_stage:string;prediction_access_product_matches:{match_id:string;kickoff_at:string}[]};prediction_payments:PaymentSnapshot|PaymentSnapshot[]|null}>;
  const memberships=membershipResult.data as {match_id:string;kickoff_at:string}[];
  const matches=new Map<string,MatchSeed>();
  for(const membership of memberships)matches.set(membership.match_id,{matchId:membership.match_id,kickoffAt:membership.kickoff_at,purchased:false,purchasedStages:new Set(),amount:null,currency:null});
  for(const grant of grants)for(const membership of grant.prediction_access_products.prediction_access_product_matches){
    const item=matches.get(membership.match_id)||{matchId:membership.match_id,kickoffAt:membership.kickoff_at,purchased:false,purchasedStages:new Set<string>(),amount:null,currency:null};
    item.purchased=true;
    item.purchasedStages.add(grant.prediction_access_products.prediction_stage);
    const payment=successfulPayment(grant.prediction_payments);
    if(payment){item.amount=Number(payment.amount);item.currency=payment.currency}
    matches.set(membership.match_id,item);
  }
  const resolved=await Promise.all([...matches.values()].map(async item=>{
    try{const current=await getLiveFootballPrediction(item.matchId);return{...item,purchasedStages:[...item.purchasedStages],competition:current.competition,homeTeam:current.home_team,awayTeam:current.away_team,status:current.status,isFinal:isAuthoritativeFinal(current),finalScore:current.current_score}}
    catch{return{...item,purchasedStages:[...item.purchasedStages],competition:"",homeTeam:"",awayTeam:"",status:"Unavailable",isFinal:false,finalScore:null}}
  }));
  return resolved.filter(match=>match.purchased||match.isFinal).sort((left,right)=>Date.parse(right.kickoffAt)-Date.parse(left.kickoffAt));
}

export async function loadPostMatchReport(userId:string,matchId:string,now=new Date()):Promise<PostMatchReport>{
  const [current,timeline]=await Promise.all([getLiveFootballPrediction(matchId),getLiveFootballPredictionHistory(matchId)]);
  if(!isAuthoritativeFinal(current)||!current.current_score)throw new ReportAccessError("not_final");
  const history=timeline.history.filter((entry):entry is FootballPredictionHistoryEntry=>!("locked" in entry)),finalScore=current.current_score;
  const stages:[StageReview["stage"],FootballPredictionHistoryEntry|null][]=[["PREMATCH",choose(history,"PREMATCH")],["LIVE",choose(history,"LIVE")],["HALFTIME",choose(history,"HALFTIME")]];
  const reviews=stages.map(([stage,snapshot])=>({stage,snapshot,outcomeResult:evaluateOutcome(snapshot?.predicted_outcome,finalScore),exactResult:evaluateExact(snapshot?.predicted_score,finalScore),scoreStrength:snapshot?.predicted_score?100:null,actualRank:snapshot?.predicted_score&&evaluateExact(snapshot.predicted_score,finalScore)==="CORRECT"?1:null,marketResult:"NOT APPLICABLE" as const}));
  const admin=getServerSupabaseClient();
  const {data:payments}=await admin.from("prediction_payments").select("amount,currency,prediction_access_products!inner(prediction_stage,prediction_access_product_matches!inner(match_id))").eq("user_id",userId).eq("status","successful").eq("prediction_access_products.prediction_access_product_matches.match_id",matchId);
  const paid=payments as unknown as {amount:number;currency:string;prediction_access_products:{prediction_stage:string}}[]|null;
  const outcome=outcomeForScore(finalScore),winner=outcome==="draw"?"a draw":outcome==="home_win"?`${timeline.home_team} winning`:`${timeline.away_team} winning`;
  const available=reviews.filter(review=>review.snapshot);
  const summary=available.length?`Predictive Compass recorded ${available.length} historical prediction stage${available.length===1?"":"s"} for this match. The verified match result was ${timeline.home_team} ${finalScore.home}-${finalScore.away} ${timeline.away_team}, with ${winner}.`:"No historical prediction snapshots are available for this completed match. The verified final result is preserved below.";
  const timestamps=history.map(entry=>entry.generated_at).filter((value):value is string=>Boolean(value));
  return{reportId:`PCR-${current.kickoff_at?.slice(0,4)||now.getUTCFullYear()}-${createHash("sha256").update(matchId+timestamps.join("|")).digest("hex").slice(0,8).toUpperCase()}`,matchId,competition:timeline.competition,homeTeam:timeline.home_team,awayTeam:timeline.away_team,kickoffAt:timeline.kickoff_at,finalScore,finalStatus:"FINAL",generatedAt:now.toISOString(),purchase:paid?.length?{amount:Number(paid[0].amount),currency:paid[0].currency,stages:[...new Set(paid.map(payment=>payment.prediction_access_products.prediction_stage))]}:null,reviews,snapshotTimestamps:timestamps,summary}
}
