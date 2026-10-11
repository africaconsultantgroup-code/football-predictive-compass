export const PERFORMANCE_PERIODS = ["today", "7d", "30d", "season"] as const;
export type PerformancePeriod = typeof PERFORMANCE_PERIODS[number];
export const PERIOD_LABELS: Record<PerformancePeriod,string> = {today:"Today","7d":"Last 7 Days","30d":"Last 30 Days",season:"Season"};
export const PERFORMANCE_METHODOLOGY = "Performance is calculated only from Premium Match Intelligence that was customer-visible and frozen before kickoff.";
export const PERFORMANCE_EMPTY = "No verified Premium performance records are available for this period yet.";
export function performancePeriod(value: unknown): PerformancePeriod {
  return PERFORMANCE_PERIODS.includes(value as PerformancePeriod) ? value as PerformancePeriod : "7d";
}
export function performanceWindow(period: PerformancePeriod, now = new Date()) {
  const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  const start=new Date(end);
  if(period==="7d"||period==="30d") start.setUTCDate(start.getUTCDate()-(period==="7d"?6:29));
  if(period==="season") start.setUTCFullYear(end.getUTCFullYear()-(end.getUTCMonth()<6?1:0),6,1);
  return {period,label:PERIOD_LABELS[period],from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)};
}
export type PerformanceMatch = {
  competition:string;homeTeam:string;awayTeam:string;kickoffAt:string;
  compassPick:string;probability:number;strength:string;
  scoreForecast:{home:number;away:number}|null;actualScore:{home:number;away:number};
  pickCorrect:boolean;exactCorrect:boolean|null;
};
export function summarizePerformance(matches:PerformanceMatch[]) {
  const settled=matches.length,correct=matches.filter(m=>m.pickCorrect).length,exact=matches.filter(m=>m.exactCorrect===true).length;
  return {settled,correct,accuracy:settled?correct/settled*100:null,exact,exactAccuracy:settled?exact/settled*100:null};
}
export function performancePercent(value:number|null){return value===null?"Unavailable":`${value.toFixed(1)}%`;}
export function performanceKickoff(value:string){return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Accra"}).format(new Date(value))+" GMT";}
export type PerformanceReport={window:ReturnType<typeof performanceWindow>;matches:PerformanceMatch[];summary:ReturnType<typeof summarizePerformance>};
