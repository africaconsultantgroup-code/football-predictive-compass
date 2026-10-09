import Link from "next/link";
import { unavailableFreePrematch, type FreePrematchPrediction } from "../../lib/predictive-compass/free";
import type { PredictionAccessOffer } from "../../lib/auth/match-access";
import { formatProductPrice } from "../../lib/payments/format";
import { formatFootballStage, formatPredictedOutcome, formatProbability } from "../../lib/predictive-compass/presentation";
import type { FootballPrediction } from "../../lib/predictive-compass/schema";
import { CheckoutButton } from "../checkout-button";
import { CUSTOMER_COMPETITIONS, type PredictionView, type UpcomingFilter } from "../predictions";
import { MatchSelection } from "./match-basket";
import { MATCH_PRICING_POLICY, formatPesewas } from "../../lib/payments/match-pricing";

function matchesHref(filter: UpcomingFilter, competition?: string) {
  const query = new URLSearchParams();
  if (filter !== "all") query.set("filter", filter);
  query.set("competition", competition ?? "all");
  return `/matches?${query}`;
}

export function CompetitionTabs({ selected, filter }: { selected?: string; filter: UpcomingFilter }) {
  return <nav className="matches-competitions" id="competitions" aria-label="Competition">
    {CUSTOMER_COMPETITIONS.map(item => <Link key={item} href={matchesHref(filter, item)} aria-current={selected === item ? "page" : undefined}>{item === "UEFA Champions League" ? "Champions League" : item}</Link>)}
    {["La Liga", "Bundesliga", "Serie A"].map(item => <button key={item} type="button" disabled title="This competition is not available yet">{item}<small>Coming soon</small></button>)}
    <Link href={matchesHref(filter)} aria-current={!selected ? "page" : undefined}>All competitions</Link>
  </nav>;
}

export function DateSelector({ selected, filter }: { selected?: string; filter: UpcomingFilter }) {
  return <details className="matches-date-selector"><summary><span aria-hidden="true">▦</span>{filter === "all" ? "All dates" : filter === "week" ? "This week" : filter === "today" ? "Today" : "Tomorrow"}<span aria-hidden="true">⌄</span></summary><nav aria-label="Date filters">{(["all", "today", "tomorrow", "week"] as const).map(value => <Link key={value} href={matchesHref(value, selected)} aria-current={filter === value ? "true" : undefined}>{value === "all" ? "All dates" : value === "week" ? "This week" : value === "today" ? "Today" : "Tomorrow"}</Link>)}</nav></details>;
}

// Design preview only: these products have no pricing/entitlement integration.
// Never pass these indicative prices or synthetic product IDs to checkout.
const PREVIEW_PRICING = { matchday: 48, perMatch: 8, prematch: 20, fullMatch: 25 } as const;

export function MatchdayPass({ matchCount }: { matchCount: number }) {
  return <aside className="matches-pass" aria-label="Matchday Pass preview"><div><span className="matches-pass-icon" aria-hidden="true">✧</span><div><h2>Matchday Pass</h2><p>{matchCount ? `Get Premium predictions for all ${matchCount} games` : "Premium predictions for your matchday"}</p><small>Coming soon · preview pricing</small></div></div><div className="matches-pass-price"><strong>GHS {PREVIEW_PRICING.matchday}</strong><span>GHS {PREVIEW_PRICING.perMatch} per match</span></div><button type="button" disabled>View Pass</button></aside>;
}

export function OutcomeProbabilityBar({ probabilities }: { probabilities: FootballPrediction["probabilities"] }) {
  const outcomes = [["Home", probabilities.home_win], ["Draw", probabilities.draw], ["Away", probabilities.away_win]] as const;
  return <div className="matches-probabilities"><div className="matches-probability-track" aria-hidden="true">{outcomes.map(([label, value]) => <span key={label} className={`matches-probability-${label.toLowerCase()}`} style={{ flexBasis: `${value}%` }} />)}</div><dl>{outcomes.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatProbability(value)}</dd></div>)}</dl></div>;
}

export function FreePredictionSummary({ prediction, freePrediction }: { prediction: Pick<PredictionView, "match_id" | "competition" | "home_team" | "away_team" | "kickoff_at" | "stage">; freePrediction?: FreePrematchPrediction }) {
  const href = prediction.match_id ? `/matches/${prediction.match_id}` : null;
  const free = freePrediction && prediction.stage === "PREMATCH" && freePrediction.match_id === prediction.match_id ? freePrediction : prediction.match_id ? unavailableFreePrematch({ ...prediction, match_id: prediction.match_id }) : null;
  return <section className="matches-free" aria-label="Free prediction summary"><span className="matches-summary-badge">FREE PRE-MATCH</span>
    {free?.status === "available" ? <><h3><span>Most Likely:</span> {formatPredictedOutcome(free)}</h3><OutcomeProbabilityBar probabilities={free.probabilities} /></> : <><h3>Free prediction unavailable</h3><p>A free pre-match forecast is not available for this match yet.</p></>}
    {href ? <Link href={href} className="matches-free-link">View Free Prediction<span aria-hidden="true">?</span></Link> : <p className="matches-link-unavailable">Match details unavailable</p>}
  </section>;
}

export function PremiumOption({ offer, unlocked = false, completed = false, href, matchLabel, fullMatch = false }: { offer?: PredictionAccessOffer; unlocked?: boolean; completed?: boolean; href?: string; matchLabel: string; fullMatch?: boolean }) {
  const available = !completed && !fullMatch && offer && offer.priceAmount !== null;
  return <div className={`matches-premium-option${fullMatch ? " matches-premium-full" : ""}`}>
    {fullMatch ? <span className="matches-best-value">BEST VALUE · COMING SOON</span> : null}
    <div className="matches-premium-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4" /></svg><strong>{completed ? "Completed" : unlocked ? "Unlocked" : available ? formatProductPrice(offer.priceAmount!, offer.currency) : `GHS ${fullMatch ? PREVIEW_PRICING.fullMatch : PREVIEW_PRICING.prematch}`}</strong></div>
    <h3>{fullMatch ? "Full Match Intelligence" : "Premium Pre-Match"}</h3>
    {completed ? <button type="button" disabled>Match completed</button> : unlocked ? href ? <Link className="matches-option-link" href={href}>View your prediction →</Link> : <span>Access active</span> : available ? <CheckoutButton offer={offer} matchLabel={matchLabel} stage="Prematch" /> : <><small>{fullMatch ? "Coming soon · preview pricing" : "Pricing unavailable · preview only"}</small><button type="button" disabled>{fullMatch ? "Coming soon" : "Unavailable"}</button></>}
  </div>;
}

function TeamIdentity({ name }: { name: string }) {
  // The customer schema currently has no crest URL. Use a neutral monogram,
  // not an invented club crest or an external image matched only by team name.
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("");
  return <div className="matches-team"><span className="matches-team-fallback" aria-hidden="true">{initials}</span><span>{name}</span></div>;
}

export function FreeOnlyMatchRow({ free }: { free: FreePrematchPrediction }) {
  const label = `${free.home_team} vs ${free.away_team}`;
  const time = free.kickoff_at ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" }).format(new Date(free.kickoff_at)) : "TBC";
  return <article className="matches-row" id={free.match_id} aria-label={label}>
    <div className="matches-match"><div className="matches-row-stage">Pre-Match</div><TeamIdentity name={free.home_team} /><span className="matches-versus">vs</span><TeamIdentity name={free.away_team} /></div>
    <div className="matches-kickoff"><span className="matches-mobile-label">Kickoff</span><time dateTime={free.kickoff_at ?? undefined}>{time}</time><small>GMT · Ghana time</small></div>
    <FreePredictionSummary prediction={free} freePrediction={free} />
    <section className="matches-premium" aria-label="Premium options"><div className="matches-premium-option"><h3>Premium Pre-Match</h3><p>View match details for premium access and availability.</p><Link className="matches-option-link" href={`/matches/${free.match_id}`}>View Premium Intelligence →</Link></div></section>
  </article>;
}

export function MatchRow({ prediction, freePrediction, pricingV2 = false }: { prediction: PredictionView; freePrediction?: FreePrematchPrediction; pricingV2?: boolean }) {
  const locked = "locked" in prediction;
  const offers = locked ? prediction.offers.filter(offer => offer.scopeType === "match") : [];
  const href = prediction.match_id ? `/matches/${prediction.match_id}` : undefined;
  const label = `${prediction.home_team} vs ${prediction.away_team}`;
  const time = prediction.kickoff_at ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" }).format(new Date(prediction.kickoff_at)) : "TBC";
  return <article className="matches-row" id={prediction.match_id ?? prediction.prediction_id} aria-label={label}>
    <div className="matches-match">{pricingV2 ? <small>{prediction.competition}</small> : null}<div className="matches-row-stage">{formatFootballStage(prediction.stage)}{!locked ? <span>Access active</span> : null}</div><TeamIdentity name={prediction.home_team} /><span className="matches-versus">vs</span><TeamIdentity name={prediction.away_team} /></div>
    <div className="matches-kickoff"><span className="matches-mobile-label">Kickoff</span><time dateTime={prediction.kickoff_at ?? undefined}>{time}</time><small>GMT · Ghana time</small></div>
    <FreePredictionSummary prediction={prediction} freePrediction={freePrediction} />
    <section className="matches-premium" aria-label="Premium options">{pricingV2 ? <div className="matches-premium-option"><h3>Premium Match Intelligence</h3><p>{formatPesewas(MATCH_PRICING_POLICY.standardUnit)} · All available stages and historical review.</p>{prediction.match_id ? <MatchSelection matchId={prediction.match_id} /> : null}{!locked && href ? <Link href={href}>View Premium Intelligence →</Link> : null}</div> : <>{offers.length && prediction.stage !== "FINAL" ? offers.map(offer => <PremiumOption key={offer.productId} offer={offer} href={href} matchLabel={label} />) : <PremiumOption unlocked={!locked} completed={prediction.stage === "FINAL"} href={href} matchLabel={label} />}<PremiumOption fullMatch matchLabel={label} completed={prediction.stage === "FINAL"} /></>}</section>
  </article>;
}
