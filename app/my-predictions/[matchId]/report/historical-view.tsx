import { HistoricalPremiumBadge } from "../../../historical-premium-status";
import { TeamIdentity } from "../../../team-identity";
import type { PostMatchReport } from "../../../../lib/reports/post-match";
import { evaluateExact, evaluateOutcome } from "../../../../lib/reports/post-match";
import { historicalClassification, legacyNote, officialNote, pickOutcome } from "../../../../lib/reports/historical";

export function HistoricalMatchView({report:r}:{report:PostMatchReport}) {
  const p=r.premium, free=r.free, history=r.history??[];
  const score=p?.score_forecast?.most_likely_score;
  const unavailable=<p>Historical snapshot unavailable</p>;
  return <div className="historical-report">
    <header><p>{r.competition}</p><h1><TeamIdentity inline name={r.homeTeam} team={r.homeIdentity}/><span>{r.finalScore.home} – {r.finalScore.away}</span><TeamIdentity inline name={r.awayTeam} team={r.awayIdentity}/></h1><strong>FINAL</strong>{p?<div className="historical-premium-heading"><p>Premium Pre-Match Intelligence</p><HistoricalPremiumBadge classification={historicalClassification(p)}/></div>:null}<p>{r.kickoffAt?new Date(r.kickoffAt).toUTCString():"Kickoff unavailable"}</p></header>
    <ol className="historical-lifecycle" aria-label="Match lifecycle"><li>FREE PRE-MATCH</li><li>PREMIUM PRE-MATCH</li><li>LIVE / HALFTIME</li><li>FINAL RESULT</li></ol>
    <section><h2>Premium Pre-Match Intelligence</h2>{p?<>
      <strong>{historicalClassification(p)}</strong><p>{p.access_status==="LEGACY_PREMATCH"?legacyNote:officialNote}</p>
      <div className="historical-results"><article><h3>Compass Pick</h3><b>{p.compass_pick?.selection??"Unavailable"}</b><p>{p.compass_pick?`${p.compass_pick.model_probability}%`:"Probability unavailable"}</p><strong>{evaluateOutcome(pickOutcome(p.compass_pick?.selection,r.homeTeam,r.awayTeam),r.finalScore)}</strong></article>
      <article><h3>Predicted Score</h3><b>{score?`${r.homeTeam} ${score.home}–${score.away} ${r.awayTeam}`:"Unavailable"}</b><p>Actual: {r.homeTeam} {r.finalScore.home}–{r.finalScore.away} {r.awayTeam}</p><strong>Exact Score: {evaluateExact(score,r.finalScore)}</strong><p>Exact-score probability: {p.score_forecast?.score_probability==null?"Unavailable":`${p.score_forecast.score_probability}%`}</p></article></div>
      <h3>Home / Draw / Away Probabilities</h3>{p.probabilities?<div className="historical-results"><p>{r.homeTeam}: {p.probabilities.home_win}%</p><p>Draw: {p.probabilities.draw}%</p><p>{r.awayTeam}: {p.probabilities.away_win}%</p></div>:unavailable}
      <h3>Recommendation Strength</h3><p>{p.recommendation_strength?.label??"Unavailable"}</p>
      <h3>Bookmaker vs Compass</h3>{p.bookmaker_comparison.length?p.bookmaker_comparison.map((b,i)=><article key={i}><b>{b.selection}</b><p>Bookmaker: {b.bookmaker_implied_probability}% · Compass: {b.compass_probability}%</p><p>Fair odds: {b.bookmaker_consensus_fair_odds} / {b.compass_fair_odds} · Difference: {b.probability_difference} percentage points</p></article>):unavailable}
      <h3>Intelligence Reasons</h3>{p.intelligence_reasons.length?p.intelligence_reasons.map((reason,i)=><p key={i}><b>{reason.category}: </b>{reason.summary}</p>):unavailable}
      <h3>Forecast Change</h3><p>Unavailable in this historical snapshot.</p>
      <p>Generated: {p.generated_at??"Unavailable"}</p><p>Frozen evidence cutoff: {p.evidence_cutoff_at??"Unavailable"}</p>
    </>:<p>{r.premiumUnlocked?"No frozen Premium pre-match intelligence is available for this match.":"Premium historical intelligence is available to customers who own this match. Sign in with the purchasing account to view it."}</p>}</section>
    <section><h2>Free Pre-Match Forecast</h2>{free?.status==="available"?<><b>{free.predicted_outcome==="draw"?"Draw":`${free.predicted_outcome==="home_win"?r.homeTeam:r.awayTeam} Win`} — {free.probabilities[free.predicted_outcome]}%</b><p>{evaluateOutcome(free.predicted_outcome,r.finalScore)}</p><time>{free.generated_at}</time></>:<p>No immutable Free forecast is available for this match.</p>}</section>
    <section><h2>Live / Halftime History</h2>{history.length?<details><summary>View recorded match timeline ({history.length})</summary>{history.map((h,i)=><article key={i}><h3>{h.stage.replaceAll("_"," ")}{h.minute!=null?` · ${h.minute} minutes`:""}</h3><p>{h.current_score?`${h.current_score.home}–${h.current_score.away}`:"Score unavailable"} · {h.generated_at??"Timestamp unavailable"}</p><p>{h.change_description}</p><p>{r.homeTeam}: {h.probabilities.home_win}% · Draw: {h.probabilities.draw}% · {r.awayTeam}: {h.probabilities.away_win}%</p><p>Stored forecast: {h.predicted_outcome.replaceAll("_"," ")} · {h.predicted_score?`${h.predicted_score.home}–${h.predicted_score.away}`:"Score unavailable"}</p></article>)}</details>:<p>{r.premiumUnlocked?"No live intelligence was recorded for this match.":"Live history requires match ownership."}</p>}</section>
  </div>;
}
