import type { PredictionAccessOffer } from "../lib/auth/match-access";

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
    </span>
  );
}

export function FootballHero() {
  return (
    <section className="hero-grid" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow"><span className="status-dot" />Data-driven football insights</p>
        <h1 id="hero-title">Smarter Football<br /><span>Predictions</span></h1>
        <p className="hero-intro">Data-driven match insights highlighting the most likely outcomes, probabilities and evolving match intelligence — not guarantees.</p>
        <div className="benefit-grid">
          <Benefit icon="chart" title="Data-Backed Analysis" text="Advanced statistics & models" />
          <Benefit icon="target" title="Most Likely Outcome" text="Understand the modeled edge" />
          <Benefit icon="signal" title="Probability Guidance" text="Confidence, not certainty" />
        </div>
        <PredictionDisclaimer compact />
      </div>
      <div className="stadium-visual" aria-label="Football intelligence visualization">
        <div className="stadium-glow" />
        <div className="pitch-orbit orbit-one" />
        <div className="pitch-orbit orbit-two" />
        <div className="football-ball"><span /><i /></div>
        <div className="visual-stat stat-primary"><small>Model signal</small><strong>LIVE</strong><span>Updating with match data</span></div>
        <div className="visual-stat stat-secondary"><small>Intelligence</small><strong>3 stages</strong><span>Prematch · Live · Halftime</span></div>
        <div className="stadium-caption"><span className="status-dot" />Probability-led match intelligence</div>
      </div>
    </section>
  );
}

function Benefit({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="benefit-card"><span className={`benefit-icon ${icon}`} aria-hidden="true" /><div><strong>{title}</strong><small>{text}</small></div></div>;
}

export function PredictionDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "prediction-note compact" : "prediction-note"} role="note">
      <span aria-hidden="true">i</span>
      <p>{compact ? "Predictions are probability-based and may change as the match unfolds." : "Confidence reflects model strength, not certainty. Football remains unpredictable; use predictions as insight, not certainty."}</p>
    </div>
  );
}

export function PredictionStageSelector() {
  return (
    <aside className="stage-selector" aria-label="Prediction stages">
      <div className="section-kicker">Prediction stages</div>
      <a className="stage-option prematch" href="#prematch"><span className="stage-symbol">01</span><span><strong>Prematch</strong><small>Before kickoff</small></span><b>View</b></a>
      <a className="stage-option live" href="#live-matches"><span className="stage-symbol">02</span><span><strong>Live</strong><small>During the match</small></span><b>View</b></a>
      <a className="stage-option halftime" href="#live-matches"><span className="stage-symbol">03</span><span><strong>Halftime</strong><small>At half-time</small></span><b>View</b></a>
      <p className="stage-helper">Each prediction stage is purchased separately because the model receives new information as the match develops.</p>
    </aside>
  );
}

export function HowToReadPrediction() {
  return (
    <section id="how-it-works" className="info-card how-to-read" aria-labelledby="read-title">
      <p className="section-kicker">Probability explained</p>
      <h2 id="read-title">How to Read This</h2>
      <dl>
        <div><dt>Higher percentage</dt><dd>Stronger modeled likelihood</dd></div>
        <div><dt>Confidence</dt><dd>Strength of prediction evidence, not certainty</dd></div>
        <div><dt>Football remains unpredictable</dt><dd>Every outcome still carries uncertainty</dd></div>
      </dl>
      <p>Our models identify the outcome with the highest estimated probability using available match data. They improve understanding, but no football result is guaranteed.</p>
    </section>
  );
}

export function PaymentTrustCard() {
  return (
    <section id="pricing" className="info-card payment-trust" aria-labelledby="payment-title">
      <span className="shield-icon" aria-hidden="true">✓</span>
      <div><p className="section-kicker">Protected checkout</p><h2 id="payment-title">Secure Payments</h2><p>Powered by Paystack</p></div>
      <div className="payment-methods"><span>Card</span><span>Mobile Money</span></div>
    </section>
  );
}

export function WhyPredictiveCompass() {
  const items = ["Understand the most likely match outcomes", "Compare probabilities between outcomes", "See model confidence", "Review important match factors", "Follow prediction changes as the match develops", "Access stage-specific intelligence"];
  return (
    <section className="value-section" aria-labelledby="value-title">
      <div><p className="section-kicker">Clarity at every stage</p><h2 id="value-title">Why Use Predictive Compass?</h2><p>Football intelligence designed to make complex model outputs clear and useful.</p></div>
      <ul>{items.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>
      <strong className="value-signoff">Insights, not guarantees.</strong>
    </section>
  );
}

export function PredictionEmptyState({ live = false }: { live?: boolean }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">⌁</span>
      <h3>{live ? "No matches are live right now." : "No prediction offers available right now."}</h3>
      <p>{live ? "Live intelligence will appear here when an eligible match gets underway." : "New prediction opportunities will appear here as fixtures become eligible."}</p>
    </div>
  );
}

export function OfferList({ offers, matchLabel, stage }: { offers: PredictionAccessOffer[]; matchLabel: string; stage: "Prematch" | "Live" | "Halftime" }) {
  if (!offers.length) return <p className="offer-unavailable">No purchasable {stage.toLowerCase()} offer is currently available.</p>;
  return <div className="offer-list">{offers.map((offer) => <OfferCard key={offer.productId} offer={offer} matchLabel={matchLabel} stage={stage} />)}</div>;
}

function OfferCard({ offer, matchLabel, stage }: { offer: PredictionAccessOffer; matchLabel: string; stage: string }) {
  const isSlot = offer.scopeType === "kickoff_slot";
  return (
    <div className={`offer-card ${isSlot ? "slot-offer" : "match-offer"}`}>
      <div className="offer-heading">
        <span className="offer-stage">{stage}</span>
        {isSlot ? <span className="offer-scope">Kickoff Slot · {offer.matchCount} Matches</span> : <span className="offer-scope">Single match</span>}
      </div>
      <strong>{offer.name}</strong>
      {isSlot ? <p>Includes all {offer.matchCount} matches in this kickoff.</p> : <p>{matchLabel}</p>}
      <div className="offer-action">
        <span className="offer-price">{offer.priceAmount === null ? "Price coming soon" : `${offer.currency} ${offer.priceAmount.toFixed(2)}`}</span>
        {offer.priceAmount !== null ? <CheckoutLauncher offer={offer} matchLabel={matchLabel} stage={stage} /> : null}
      </div>
    </div>
  );
}

// Imported lazily through this local bridge to keep the offer markup reusable.
import { CheckoutButton as CheckoutLauncher } from "./checkout-button";
