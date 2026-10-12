import type { HistoricalPremium } from "../predictive-compass/historical-contract";
export const legacyNote = "This genuine pre-match forecast was created before the current T-30 Premium lifecycle. It is preserved for historical transparency and is excluded from official Premium performance statistics.";
export const officialNote = "This Premium prediction was customer-visible and frozen before kickoff and is included in official Premium performance statistics.";
export function historicalClassification(p:HistoricalPremium):"OFFICIAL PREMIUM" | "LEGACY PRE-MATCH INTELLIGENCE" {
  return p.access_status === "LOCKED_PRE_KICKOFF" && p.official_performance_eligible ? "OFFICIAL PREMIUM" : "LEGACY PRE-MATCH INTELLIGENCE";
}
export function pickOutcome(selection:string|undefined,home:string,away:string) {
  const clean=(s:string)=>s.toLowerCase().trim();
  const pick=clean(selection??"");
  if (["draw","draw match","match draw"].includes(pick)) return "draw";
  if ([home,`${home} win`,`${home} to win`].map(clean).includes(pick)) return "home_win";
  if ([away,`${away} win`,`${away} to win`].map(clean).includes(pick)) return "away_win";
  return undefined;
}
