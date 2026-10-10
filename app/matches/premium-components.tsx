import Link from "next/link";
import type { FreePrematchPrediction } from "../../lib/predictive-compass/free";
import type { PremiumCustomerPrediction } from "../../lib/predictive-compass/premium";
import type { PremiumIntelligence } from "../../lib/predictive-compass/premium-contract";
import { OutcomeProbabilityBar } from "./match-components";
import { FreeForecastCard } from "./free-detail";

type SectionProps = { intelligence: PremiumIntelligence | null };
function outcomeLabel(outcome: "home_win" | "draw" | "away_win", prediction: PremiumCustomerPrediction) {
  return outcome === "draw" ? "Draw" : `${outcome === "home_win" ? prediction.home_team : prediction.away_team} Win`;
}

export function PremiumForecastHero({ prediction, updating = false }: { prediction: PremiumCustomerPrediction | null; updating?: boolean }) {
  const forecast = prediction?.premium_intelligence.primary_forecast;
  return <section className="premium-forecast-hero" aria-label="Premium forecast"><div><span className="premium-badge">PREMIUM MATCH INTELLIGENCE</span><p>Most Likely Outcome</p>
    {forecast && prediction ? <><h2>{outcomeLabel(forecast.most_likely_outcome, prediction)}</h2><strong className="premium-main-probability">{forecast.probabilities[forecast.most_likely_outcome]}<span>%</span></strong><OutcomeProbabilityBar probabilities={forecast.probabilities} teamNames={{ home: prediction.home_team, away: prediction.away_team }} /></> : <div role="status"><h2>Premium forecast is being prepared.</h2><p>Your premium access remains active. No new purchase is required.</p></div>}
    {updating ? <small role="status">A match-information check is underway.</small> : null}
    <small>Regulation time · 90 minutes. Probabilities are possibilities, not guarantees.</small></div><span className="premium-compass-mark" aria-hidden="true">✧</span></section>;
}

export function CompassPickCard({ intelligence }: SectionProps) {
  const pick = intelligence?.availability.compass_pick === "available" ? intelligence.compass_pick : null;
  return <section className={`premium-panel premium-pick${pick ? "" : " premium-unavailable"}`}><span className="premium-section-symbol" aria-hidden="true">✧</span><div><h2>Compass Pick</h2>{pick ? <><h3>{pick.selection}</h3><strong>{pick.model_probability}%</strong><p>{pick.market} · {pick.strength}</p><small>Predictive Compass&apos;s strongest current 1X2 outcome.</small></> : <p>Compass Pick is unavailable for this forecast.</p>}</div></section>;
}

export function BookmakerComparisonCard({ intelligence }: SectionProps) {
  const rows = intelligence?.availability.bookmaker_comparison === "available" ? intelligence.bookmaker_comparison : [];
  return <section className={`premium-panel${rows.length ? "" : " premium-unavailable"}`}><h2>Bookmaker vs Compass</h2>{rows.length ? <div className="premium-intelligence-list">{rows.map((row, index) => <article key={index}><h3>{row.selection}</h3><dl className="premium-metrics"><div><dt>Bookmaker consensus fair odds</dt><dd>{row.bookmaker_consensus_fair_odds}</dd></div><div><dt>Bookmaker implied probability</dt><dd>{row.bookmaker_implied_probability}%</dd></div><div><dt>Compass probability</dt><dd>{row.compass_probability}%</dd></div><div><dt>Compass fair odds</dt><dd>{row.compass_fair_odds}</dd></div><div><dt>Probability difference</dt><dd>{row.probability_difference > 0 ? "+" : ""}{row.probability_difference} pp</dd></div></dl></article>)}</div> : <p>Bookmaker comparison is not available for this forecast.</p>}</section>;
}

export function MarketOpportunityList({ intelligence }: SectionProps) {
  const rows = intelligence?.availability.market_opportunities === "available" ? intelligence.market_opportunities : [];
  return <section className="premium-panel"><h2>Ranked 1X2 Opportunities</h2><small>Match Result · Regulation time only</small>{rows.length ? <ol className="premium-intelligence-list">{rows.map((row, index) => <li key={index} value={row.rank}><h3>{row.selection}</h3><p>{row.probability}% · {row.strength}{row.preferred ? " · Compass Pick" : ""}</p></li>)}</ol> : <p>Ranked opportunities are unavailable for this forecast.</p>}</section>;
}

export function IntelligenceReasonList({ intelligence }: SectionProps) {
  const rows = intelligence?.availability.intelligence_reasons === "available" ? intelligence.intelligence_reasons : [];
  return <section className="premium-panel"><h2>Why Compass Thinks This</h2>{rows.length ? <div className="premium-intelligence-list">{rows.map((row, index) => <article key={index}><h3>{row.category}</h3><p>{row.summary}</p></article>)}</div> : <p>Intelligence reasons are unavailable for this forecast.</p>}</section>;
}

export function RecommendationStrength({ intelligence }: SectionProps) {
  const strength = intelligence?.recommendation_strength;
  return <section className="premium-panel"><h2>Recommendation Strength</h2>{strength && strength.label !== "Unavailable" ? <><p>Recommendation: {strength.label}{strength.score !== null ? ` · ${strength.score}/100` : ""}</p><small>Recommendation strength is not certainty.</small></> : <p>Recommendation strength is unavailable for this forecast.</p>}</section>;
}

export function ScoreForecastCard({ prediction }: { prediction: PremiumCustomerPrediction | null }) {
  const intelligence = prediction?.premium_intelligence;
  const score = intelligence?.availability.score_forecast === "available" && intelligence.score_forecast.status === "available" ? intelligence.score_forecast : null;
  return <section className="premium-panel"><h2>Score Forecast</h2>{score?.most_likely_score && prediction ? <><p>{prediction.home_team} {score.most_likely_score.home}–{score.most_likely_score.away} {prediction.away_team}</p>{score.score_probability !== null ? <p>Exact Score Probability: {score.score_probability}%</p> : <p>Exact Score Probability: unavailable for this forecast.</p>}{score.alternative_scorelines.length ? <p>Alternative scorelines: {score.alternative_scorelines.map(s => `${s.home}–${s.away}`).join(", ")}</p> : null}</> : <><p>Score forecast is unavailable for this match.</p><p>Exact Score Probability: unavailable for this forecast.</p></>}</section>;
}

export function ForecastComparison({ prediction }: { prediction: PremiumCustomerPrediction | null }) {
  const intelligence = prediction?.premium_intelligence;
  const change = intelligence?.forecast_change;
  if (!prediction || intelligence?.availability.forecast_change !== "available" || !change?.available) return <section className="premium-panel premium-unavailable"><h2>Forecast Change</h2><p>Forecast change is unavailable for this match. No comparison has been supplied.</p></section>;
  return <section className="premium-panel premium-comparison"><h2>Forecast Change</h2><div className="premium-comparison-views"><div><span>FREE FORECAST</span><h3>{outcomeLabel(change.free_leading_outcome!, prediction)}</h3><strong>{change.free_probability}%</strong></div><span className="premium-comparison-arrow" aria-hidden="true">→</span><div><span>PREMIUM FORECAST</span><h3>{outcomeLabel(change.premium_leading_outcome!, prediction)}</h3><strong>{change.premium_probability}%</strong></div></div><p>{change.probability_point_change! > 0 ? "+" : ""}{change.probability_point_change} percentage points</p><p>{change.leading_outcome_changed ? "Most likely outcome changed" : "Most likely outcome unchanged"}</p>{change.reasons.map((reason, index) => <p key={index}>{reason}</p>)}<small>A probability change does not establish which forecast will be more accurate.</small></section>;
}

export function ForecastFreshness({ prediction, updating = false, now = new Date() }: { prediction: PremiumCustomerPrediction | null; updating?: boolean; now?: Date }) {
  const time = prediction?.premium_intelligence.generated_at;
  const validTime = time && Date.parse(time) <= now.getTime();
  return <section className="premium-panel premium-freshness"><h2>Forecast Freshness</h2>{validTime ? <p>Updated <time dateTime={time}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Accra" }).format(new Date(time))} GMT</time></p> : <p>Update time unavailable</p>}<small>{!prediction ? "Your premium forecast is being prepared. Your access remains active." : updating ? "A match-information check is underway. The current stored forecast remains available." : "Your premium view uses the current available stored pre-match forecast."}</small></section>;
}

export function PremiumMatchExperience({ prediction, free, updating = false, now = new Date() }: { prediction: PremiumCustomerPrediction | null; free: FreePrematchPrediction | null; updating?: boolean; now?: Date }) {
  const intelligence = prediction?.premium_intelligence ?? null;
  return <div className="premium-experience"><PremiumForecastHero prediction={prediction} updating={updating} /><CompassPickCard intelligence={intelligence} /><BookmakerComparisonCard intelligence={intelligence} /><MarketOpportunityList intelligence={intelligence} /><IntelligenceReasonList intelligence={intelligence} /><RecommendationStrength intelligence={intelligence} /><ScoreForecastCard prediction={prediction} /><ForecastComparison prediction={prediction} /><ForecastFreshness prediction={prediction} updating={updating} now={now} />
    {free ? <section className="premium-free-reference" aria-label="Separate free forecast"><h2>Your Free Pre-Match View</h2><FreeForecastCard free={free} /></section> : null}
    <div className="premium-more"><Link href="/my-predictions">View My Predictions →</Link><p>Match reports remain available through your existing completed-match report experience.</p></div>
  </div>;
}
