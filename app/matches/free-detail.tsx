import type { FreePrematchPrediction } from "../../lib/predictive-compass/free";
import type { PredictionAccessOffer } from "../../lib/auth/match-access";
import { formatPredictedOutcome } from "../../lib/predictive-compass/presentation";
import { OutcomeProbabilityBar } from "./match-components";
import { SingleMatchCheckout } from "./match-basket";

export function FreeMatchDetail({ free, unlocked, deliverable }: { free: FreePrematchPrediction; unlocked: boolean; offers: PredictionAccessOffer[]; deliverable: boolean; pricingV2?: boolean }) {
  const label = `${free.home_team} vs ${free.away_team}`;
  return <div className="free-detail-grid">
    <FreeForecastCard free={free} />
    <aside className="free-premium-panel"><p className="matches-eyebrow">Premium Match Intelligence</p><h2>{unlocked ? "Premium Intelligence Unlocked" : "Unlock Premium Match Intelligence"}</h2>
      {unlocked ? <p>Your existing match access is active. Your purchased intelligence is shown below when available.</p> : <><p>Premium updates the prediction using the latest match information available closer to kickoff.</p><ul><li>Latest team news and player availability</li><li>Confirmed tactical information</li><li>Updated match conditions</li><li>Deeper market intelligence</li></ul>
        {deliverable ? <><p>One purchase includes every available Premium stage and historical review.</p><SingleMatchCheckout matchId={free.match_id} label={label} kickoffAt={free.kickoff_at} /></> : <p role="status">Premium intelligence being prepared. Checkout is currently unavailable.</p>}
      </>}
    </aside>
  </div>;
}

export function FreeForecastCard({ free }: { free: FreePrematchPrediction }) {
  return (
    <section className="free-detail-card" aria-label="Free pre-match prediction"><span className="matches-summary-badge">FREE PRE-MATCH</span>
      {free.status === "available" ? <><p>Most Likely Outcome</p><h2>{formatPredictedOutcome(free)}</h2><strong className="free-main-probability">{free.probabilities[free.predicted_outcome]}%</strong><OutcomeProbabilityBar probabilities={free.probabilities} /><small>Generated {new Date(free.generated_at).toLocaleString("en-GB", { timeZone: "Africa/Accra" })} GMT</small></> : <div role="status"><h2>Free prediction not available yet</h2><p>A free pre-match forecast is not available for this match yet. No outcome probabilities are shown.</p></div>}
      <div className="free-basic-view"><h3>Basic Match View</h3><p>{free.home_team} play at home against {free.away_team} in {free.competition}.</p></div>
      <small>Predictions describe possibilities, not guaranteed results.</small>
    </section>
  );
}
