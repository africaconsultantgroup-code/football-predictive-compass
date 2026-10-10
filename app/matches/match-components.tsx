import Link from "next/link";
import { unavailableFreePrematch, type FreePrematchPrediction } from "../../lib/predictive-compass/free";
import { formatFootballStage, formatPredictedOutcome, formatProbability } from "../../lib/predictive-compass/presentation";
import type { FootballPrediction } from "../../lib/predictive-compass/schema";
import { TeamIdentity } from "../team-identity";
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

export function OutcomeProbabilityBar({ probabilities }: { probabilities: FootballPrediction["probabilities"] }) {
  const outcomes = [["Home", probabilities.home_win], ["Draw", probabilities.draw], ["Away", probabilities.away_win]] as const;
  return <div className="matches-probabilities"><div className="matches-probability-track" aria-hidden="true">{outcomes.map(([label, value]) => <span key={label} className={`matches-probability-${label.toLowerCase()}`} style={{ flexBasis: `${value}%` }} />)}</div><dl>{outcomes.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatProbability(value)}</dd></div>)}</dl></div>;
}

export function FreePredictionSummary({ prediction, freePrediction }: { prediction: Pick<PredictionView, "match_id" | "competition" | "home_team" | "away_team" | "kickoff_at" | "stage">; freePrediction?: FreePrematchPrediction }) {
  const href = prediction.match_id ? `/matches/${prediction.match_id}` : null;
  const free = freePrediction && prediction.stage === "PREMATCH" && freePrediction.match_id === prediction.match_id ? freePrediction : prediction.match_id ? unavailableFreePrematch({ ...prediction, match_id: prediction.match_id }) : null;
  return <section className="matches-free" aria-label="Free prediction summary"><span className="matches-summary-badge">FREE PRE-MATCH</span>
    {free?.status === "available" ? <><h3><span>Most Likely:</span> {formatPredictedOutcome(free)}</h3><OutcomeProbabilityBar probabilities={free.probabilities} /></> : <><h3>Free prediction not available yet</h3><p>A free pre-match forecast is not available for this match yet.</p></>}
    {href ? <Link href={href} className="matches-free-link">View Free Prediction<span aria-hidden="true">?</span></Link> : <p className="matches-link-unavailable">Match details unavailable</p>}
  </section>;
}

export function FreeOnlyMatchRow({ free, owned = false, owner = false }: { free: FreePrematchPrediction; owned?: boolean; owner?: boolean }) {
  const label = `${free.home_team} vs ${free.away_team}`;
  const time = free.kickoff_at ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" }).format(new Date(free.kickoff_at)) : "TBC";
  return <article className="matches-row" id={free.match_id} aria-label={label}>
    <div className="matches-match"><small>{free.competition}</small><div className="matches-row-stage">Pre-Match</div><TeamIdentity name={free.home_team} team={free.home_team_identity} /><span className="matches-versus">vs</span><TeamIdentity name={free.away_team} team={free.away_team_identity} /></div>
    <div className="matches-kickoff"><span className="matches-mobile-label">Kickoff</span><time dateTime={free.kickoff_at ?? undefined}>{time}</time><small>GMT · Ghana time</small></div>
    <FreePredictionSummary prediction={free} freePrediction={free} />
    <section className="matches-premium" aria-label="Premium options"><div className="matches-premium-option"><h3>Premium Match Intelligence</h3>{owned ? <strong>{owner ? "Premium Unlocked" : "Premium Intelligence Unlocked"}</strong> : null}<p>Premium intelligence being prepared</p><Link className="matches-option-link" href={`/matches/${free.match_id}`}>{owned && !owner ? "View Match Intelligence" : "View Premium Intelligence"} &rarr;</Link></div></section>
  </article>;
}

export function MatchRow({ prediction, freePrediction, owner = false }: { prediction: PredictionView; freePrediction?: FreePrematchPrediction; pricingV2?: boolean; owner?: boolean }) {
  const locked = "locked" in prediction;
  const href = prediction.match_id ? `/matches/${prediction.match_id}` : undefined;
  const label = `${prediction.home_team} vs ${prediction.away_team}`;
  const time = prediction.kickoff_at ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" }).format(new Date(prediction.kickoff_at)) : "TBC";
  return <article className="matches-row" id={prediction.match_id ?? prediction.prediction_id} aria-label={label}>
    <div className="matches-match"><small>{prediction.competition}</small><div className="matches-row-stage">{formatFootballStage(prediction.stage)}{!locked ? <span>Access active</span> : null}</div><TeamIdentity name={prediction.home_team} team={prediction.home_team_identity} /><span className="matches-versus">vs</span><TeamIdentity name={prediction.away_team} team={prediction.away_team_identity} /></div>
    <div className="matches-kickoff"><span className="matches-mobile-label">Kickoff</span><time dateTime={prediction.kickoff_at ?? undefined}>{time}</time><small>GMT · Ghana time</small></div>
    <FreePredictionSummary prediction={prediction} freePrediction={freePrediction} />
    <section className="matches-premium" aria-label="Premium options"><div className="matches-premium-option"><h3>{href ? <Link href={href}>Premium Match Intelligence</Link> : "Premium Match Intelligence"}</h3>{!locked ? <><strong>{owner ? "Premium Unlocked" : "Premium Intelligence Unlocked"}</strong>{href ? <Link className="matches-option-link" href={href}>{owner ? "View Premium Intelligence" : "View Match Intelligence"} &rarr;</Link> : null}</> : <>
      <p>{formatPesewas(MATCH_PRICING_POLICY.standardUnit)} single-match starting price</p><small>All available stages and historical review.</small>
      {prediction.match_id && prediction.stage === "PREMATCH" && prediction.kickoff_at ? <MatchSelection matchId={prediction.match_id} kickoffAt={prediction.kickoff_at} label={label} /> : <><button type="button" disabled>Purchase closed</button><p>Purchasing has closed for this match.</p></>}
    </>}{!href ? <p>Match details unavailable</p> : null}{prediction.stage === "FINAL" ? <p>Completed</p> : null}</div></section>
  </article>;
}
