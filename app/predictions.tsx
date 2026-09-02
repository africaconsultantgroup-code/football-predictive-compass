import { connection } from "next/server";

import { getCustomerAccess } from "../lib/auth/access";
import { getPredictionOffers, hasPredictionAccess } from "../lib/auth/match-access";
import { toPredictionPreview, type FootballPredictionPreview } from "../lib/predictive-compass/preview";
import { formatPredictedOutcome, formatProbability, formatReliability } from "../lib/predictive-compass/presentation";
import type { FootballPrediction } from "../lib/predictive-compass/schema";
import { getUpcomingFootballPredictions } from "../lib/predictive-compass/server";
import { createCustomerAuthServerClient } from "../lib/supabase/auth-server";
import { OfferList, PredictionDisclaimer, PredictionEmptyState } from "./experience-components";

function kickoffLabel(kickoffAt: string | null) {
  if (!kickoffAt) return "Kickoff time to be confirmed";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(kickoffAt));
}

function ProbabilityBars({ prediction }: { prediction: FootballPrediction }) {
  const rows = [[prediction.home_team, prediction.probabilities.home_win], ["Draw", prediction.probabilities.draw], [prediction.away_team, prediction.probabilities.away_win]] as const;
  return <div className="probability-list">{rows.map(([label, value]) => <div className="probability-row" key={label}><div><span>{label}</span><strong>{formatProbability(value)}</strong></div><div className="probability-track"><span style={{ width: `${value}%` }} /></div></div>)}</div>;
}

export function PredictionCard({ prediction }: { prediction: FootballPrediction }) {
  const factors = prediction.customer_key_factors.slice(0, 3);
  return (
    <article className="prediction-card unlocked-card">
      <header className="fixture-header"><div><span className="stage-badge prematch">Prematch · Unlocked</span><p>{prediction.competition}</p><h3>{prediction.home_team}<span>vs</span>{prediction.away_team}</h3><time dateTime={prediction.kickoff_at ?? undefined}>{kickoffLabel(prediction.kickoff_at)}</time></div><span className="unlock-state">✓ Unlocked</span></header>
      <div className="outcome-panel"><p>Most likely outcome</p><strong>{formatPredictedOutcome(prediction)}</strong>{prediction.predicted_score ? <span>Modeled score · {prediction.predicted_score.home}–{prediction.predicted_score.away}</span> : null}</div>
      <section className="probability-panel" aria-label="Model probabilities"><div className="card-label"><span>Chances / Model Probability</span><small>Higher = stronger likelihood</small></div><ProbabilityBars prediction={prediction} /></section>
      <section className="confidence-panel"><div><span>Confidence</span><strong>{formatReliability(prediction.reliability)}</strong></div><p>Confidence indicates how strongly the available evidence supports the model&apos;s preferred outcome. It is not a guarantee.</p></section>
      {prediction.customer_summary ? <p className="prediction-summary">{prediction.customer_summary}</p> : null}
      {factors.length ? <ul className="factor-list">{factors.map((factor) => <li key={factor}><span aria-hidden="true">✓</span>{factor}</li>)}</ul> : null}
      <PredictionDisclaimer />
    </article>
  );
}

export function PredictionPreviewCard({ prediction }: { prediction: FootballPredictionPreview }) {
  const label = `${prediction.home_team} vs ${prediction.away_team}`;
  return (
    <article className="prediction-card locked-card">
      <header className="fixture-header"><div><span className="stage-badge prematch">Prematch · Available</span><p>{prediction.competition}</p><h3>{prediction.home_team}<span>vs</span>{prediction.away_team}</h3><time dateTime={prediction.kickoff_at ?? undefined}>{kickoffLabel(prediction.kickoff_at)}</time></div><span className="locked-state">◈ Locked</span></header>
      <div className="locked-preview"><span className="lock-icon" aria-hidden="true">◇</span><div><strong>Prediction available</strong><p>Unlock this stage to view the modeled outcome, probabilities, confidence and key match factors.</p><small>Locked · Match access required</small></div></div>
      <OfferList offers={prediction.offers} matchLabel={label} stage="Prematch" />
    </article>
  );
}

export function PredictionsLoading() { return <div className="loading-state" role="status"><span className="status-dot" />Loading upcoming predictions…</div>; }

async function loadPredictions() {
  try {
    const [predictions, access, supabase] = await Promise.all([getUpcomingFootballPredictions(), getCustomerAccess(), createCustomerAuthServerClient()]);
    const views = await Promise.all(predictions.map(async (prediction) => {
      const unlocked = await hasPredictionAccess({ access, supabase, matchId: prediction.match_id, stage: "prematch" });
      return unlocked ? prediction : toPredictionPreview(prediction, await getPredictionOffers(supabase, prediction.match_id, "prematch"));
    }));
    return { predictions: views, failed: false } as const;
  } catch { return { predictions: [], failed: true } as const; }
}

export async function PredictionsContent() {
  await connection();
  const { predictions, failed } = await loadPredictions();
  if (failed) return <div className="service-state" role="alert">Predictions are temporarily unavailable. Please try again shortly.</div>;
  if (!predictions.length) return <PredictionEmptyState />;
  return <div className="prediction-grid">{predictions.map((prediction) => "locked" in prediction ? <PredictionPreviewCard key={prediction.prediction_id} prediction={prediction as FootballPredictionPreview} /> : <PredictionCard key={prediction.prediction_id} prediction={prediction as FootballPrediction} />)}</div>;
}
