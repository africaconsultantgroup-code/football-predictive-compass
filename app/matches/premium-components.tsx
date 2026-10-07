import Link from "next/link";
import type { FreePrematchPrediction } from "../../lib/predictive-compass/free";
import { compareForecasts, premiumSummary, type ForecastComparisonData, type PremiumCustomerPrediction } from "../../lib/predictive-compass/premium";
import { formatPredictedOutcome } from "../../lib/predictive-compass/presentation";
import { OutcomeProbabilityBar } from "./match-components";
import { FreeForecastCard } from "./free-detail";

export function PremiumForecastHero({ prediction }: { prediction: PremiumCustomerPrediction | null }) {
  return <section className="premium-forecast-hero" aria-label="Premium forecast"><div><span className="premium-badge">PREMIUM MATCH INTELLIGENCE</span><p>Most Likely Outcome</p>
    {prediction ? <><h2>{formatPredictedOutcome(prediction)}</h2><strong className="premium-main-probability">{prediction.probabilities[prediction.predicted_outcome]}<span>%</span></strong><OutcomeProbabilityBar probabilities={prediction.probabilities} /></> : <div role="status"><h2>Premium forecast is being prepared.</h2><p>Your premium access remains active. No new purchase is required.</p></div>}
    <small>Regulation time · 90 minutes. Probabilities are possibilities, not guarantees.</small></div><span className="premium-compass-mark" aria-hidden="true">✧</span></section>;
}

export function ForecastChange({ comparison }: { comparison: ForecastComparisonData }) {
  const key = comparison.premium.predicted_outcome;
  const delta = comparison.changes[key];
  return <div className="premium-change"><strong>{comparison.leading_outcome_changed ? "Most likely outcome changed" : delta === 0 ? "Leading probability unchanged" : `${delta > 0 ? "+" : ""}${delta} percentage points`}</strong>
    <p>{comparison.leading_outcome_changed ? `The leading outcome changed from ${formatPredictedOutcome(comparison.free)} to ${formatPredictedOutcome(comparison.premium)}.` : `Change in ${formatPredictedOutcome(comparison.premium)} probability.`}</p>
    <dl>{([["Home", "home_win"], ["Draw", "draw"], ["Away", "away_win"]] as const).map(([label, key]) => <div key={key}><dt>{label}</dt><dd>{comparison.changes[key] > 0 ? "+" : ""}{comparison.changes[key]} pp</dd></div>)}</dl>
  </div>;
}

export function ForecastComparison({ comparison }: { comparison: ForecastComparisonData | null }) {
  if (!comparison) return null;
  return <section className="premium-panel premium-comparison"><div className="premium-section-heading"><span>Two distinct forecasts</span><h2>What Changed</h2><p>Compare the stored early view with your premium forecast.</p></div><div className="premium-comparison-views">
    <div><span>FREE FORECAST</span><h3>{formatPredictedOutcome(comparison.free)}</h3><strong>{comparison.free.probabilities[comparison.free.predicted_outcome]}%</strong></div><span className="premium-comparison-arrow" aria-hidden="true">→</span><div><span>PREMIUM FORECAST</span><h3>{formatPredictedOutcome(comparison.premium)}</h3><strong>{comparison.premium.probabilities[comparison.premium.predicted_outcome]}%</strong></div>
  </div><ForecastChange comparison={comparison} /><small>A probability change does not establish which forecast will be more accurate.</small></section>;
}

export function CompassPickCard() {
  return <section className="premium-panel premium-pick"><span className="premium-section-symbol" aria-hidden="true">✧</span><div><h2>Compass Pick</h2><p>Compass Pick not available yet</p><small>No approved recommendation is currently published for this match.</small></div></section>;
}

export function IntelligenceReasonList() {
  return <section className="premium-panel"><h2>Why the forecast changed</h2><p>Specific change reasons are not available for this forecast.</p><small>We only show a reason when supported by published match information.</small></section>;
}

export function MarketOpportunityList() {
  return <section className="premium-panel"><h2>Top Market Opportunities</h2><p>Ranked opportunities are not available yet.</p><small>No betting markets are inferred from the outcome probabilities shown above.</small></section>;
}

export function ScoreForecastCard() {
  return <section className="premium-panel"><h2>Score Forecast</h2><p>Advanced score intelligence coming later.</p></section>;
}

export function ForecastFreshness({ prediction, updating = false, now = new Date() }: { prediction: PremiumCustomerPrediction | null; updating?: boolean; now?: Date }) {
  const time = prediction?.generated_at ?? prediction?.updated_at;
  const validTime = time && Date.parse(time) <= now.getTime();
  return <section className="premium-panel premium-freshness"><h2>Forecast Freshness</h2>{validTime ? <p>Updated <time dateTime={time}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Accra" }).format(new Date(time))} GMT</time></p> : <p>Update time unavailable</p>}
    <small>{!prediction ? "Your premium forecast is being prepared. Your access remains active." : updating ? "A match-information check is underway. The current stored forecast remains available." : "Your premium view uses the current available stored pre-match forecast."}</small></section>;
}

export function PremiumMatchExperience({ prediction, free, updating = false, now = new Date() }: { prediction: PremiumCustomerPrediction | null; free: FreePrematchPrediction | null; updating?: boolean; now?: Date }) {
  const comparison = compareForecasts(free, prediction, now);
  return <div className="premium-experience"><PremiumForecastHero prediction={prediction} /><ForecastComparison comparison={comparison} /><CompassPickCard /><IntelligenceReasonList />
    <div className="premium-secondary-grid"><MarketOpportunityList /><ScoreForecastCard /></div>
    {prediction ? <section className="premium-panel"><h2>Premium Intelligence Summary</h2><p>{premiumSummary(prediction)}</p></section> : null}
    <ForecastFreshness prediction={prediction} updating={updating} now={now} />
    {free ? <section className="premium-free-reference" aria-label="Separate free forecast"><h2>Your Free Pre-Match View</h2><FreeForecastCard free={free} /></section> : null}
    <div className="premium-more"><Link href="/my-predictions">View My Predictions →</Link><p>Match reports remain available through your existing completed-match report experience.</p></div>
  </div>;
}
