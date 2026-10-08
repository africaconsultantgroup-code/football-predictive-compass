import type { FreePrematchPrediction } from "../../lib/predictive-compass/free";
import type { PredictionAccessOffer } from "../../lib/auth/match-access";
import { formatPredictedOutcome } from "../../lib/predictive-compass/presentation";
import { formatProductPrice } from "../../lib/payments/format";
import { CheckoutButton } from "../checkout-button";
import { OutcomeProbabilityBar } from "./match-components";

export function FreeMatchDetail({ free, unlocked, offers, deliverable }: { free: FreePrematchPrediction; unlocked: boolean; offers: PredictionAccessOffer[]; deliverable: boolean }) {
  const label = `${free.home_team} vs ${free.away_team}`;
  return <div className="free-detail-grid">
    <FreeForecastCard free={free} />
    <aside className="free-premium-panel"><p className="matches-eyebrow">Premium pre-match</p><h2>{unlocked ? "Premium Intelligence Unlocked" : "Unlock Premium Match Intelligence"}</h2>
      {unlocked ? <p>Your existing match access is active. Your purchased intelligence is shown below when available.</p> : <><p>Premium updates the prediction using the latest match information available closer to kickoff.</p><ul><li>Latest team news and player availability</li><li>Confirmed tactical information</li><li>Updated match conditions</li><li>Deeper market intelligence</li></ul>
        {deliverable && offers.length ? offers.map(offer => <div className="free-premium-offer" key={offer.productId}><strong>{offer.name}</strong><span>{offer.priceAmount === null ? "Price unavailable" : formatProductPrice(offer.priceAmount, offer.currency)}</span>{offer.priceAmount !== null ? <CheckoutButton offer={offer} stage="Prematch" matchLabel={label} label={offer.scopeType === "match" ? "Unlock Premium" : undefined} /> : null}</div>) : <p role="status">Premium checkout is currently unavailable.</p>}
      </>}
    </aside>
  </div>;
}

export function FreeForecastCard({ free }: { free: FreePrematchPrediction }) {
  return (
    <section className="free-detail-card" aria-label="Free pre-match prediction"><span className="matches-summary-badge">FREE PRE-MATCH</span>
      {free.status === "available" ? <><p>Most Likely Outcome</p><h2>{formatPredictedOutcome(free)}</h2><strong className="free-main-probability">{free.probabilities[free.predicted_outcome]}%</strong><OutcomeProbabilityBar probabilities={free.probabilities} /><small>Generated {new Date(free.generated_at).toLocaleString("en-GB", { timeZone: "Africa/Accra" })} GMT</small></> : <div role="status"><h2>Free prediction unavailable</h2><p>A free pre-match forecast is not available for this match yet. No outcome probabilities are shown.</p></div>}
      <div className="free-basic-view"><h3>Basic Match View</h3><p>{free.home_team} play at home against {free.away_team} in {free.competition}.</p></div>
      <small>Predictions describe possibilities, not guaranteed results.</small>
    </section>
  );
}
