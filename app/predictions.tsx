import { connection } from "next/server";
import Link from "next/link";

import { getCustomerAccess } from "../lib/auth/access";
import { getPredictionOffers, hasPredictionAccess } from "../lib/auth/match-access";
import { formatProductPrice } from "../lib/payments/format";
import { toPredictionPreview, type FootballPredictionPreview } from "../lib/predictive-compass/preview";
import { formatPredictedOutcome, formatProbability, formatReliability } from "../lib/predictive-compass/presentation";
import type { FootballPrediction } from "../lib/predictive-compass/schema";
import { getUpcomingFootballPredictions } from "../lib/predictive-compass/server";
import { createCustomerAuthServerClient } from "../lib/supabase/auth-server";
import { CheckoutButton } from "./checkout-button";
import { OfferList, PredictionDisclaimer, PredictionEmptyState } from "./experience-components";

type PredictionView = FootballPrediction | FootballPredictionPreview;

export type UpcomingFilter = "all" | "today" | "tomorrow" | "week";

export function sortPredictionViews(predictions: PredictionView[]) {
  return [...predictions].sort((a, b) => {
    if (!a.kickoff_at) return 1;
    if (!b.kickoff_at) return -1;
    return new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime();
  });
}

export function fixtureDateLabel(kickoffAt: string | null, now = new Date()) {
  if (!kickoffAt) return "Date to be confirmed";
  const date = new Date(kickoffAt);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra" }).format(date);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra" }).format(now);
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra" }).format(new Date(now.getTime() + 86_400_000));
  if (day === today) return "Today";
  if (day === tomorrow) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Accra" }).format(date);
}

export function filterPredictionViews(predictions: PredictionView[], filter: UpcomingFilter, competition?: string, now = new Date()) {
  return predictions.filter((prediction) => {
    if (competition && prediction.competition !== competition) return false;
    if (filter === "all") return true;
    if (!prediction.kickoff_at) return false;
    const kickoff = new Date(prediction.kickoff_at);
    if (filter === "week") return kickoff >= now && kickoff <= new Date(now.getTime() + 7 * 86_400_000);
    return fixtureDateLabel(prediction.kickoff_at, now) === (filter === "today" ? "Today" : "Tomorrow");
  });
}

export function UpcomingFilters({ active, competition, competitions }: { active: UpcomingFilter; competition?: string; competitions: string[] }) {
  const href = (filter: UpcomingFilter, selectedCompetition = competition) => {
    const query = new URLSearchParams();
    if (filter !== "all") query.set("filter", filter);
    if (selectedCompetition) query.set("competition", selectedCompetition);
    return `/matches${query.size ? `?${query}` : ""}`;
  };
  const allCompetitionsHref = active === "all" ? "/matches" : `/matches?filter=${active}`;
  return <div className="market-filters"><nav aria-label="Date filters">{(["all", "today", "tomorrow", "week"] as const).map((filter) => <Link className={active === filter ? "active" : ""} href={href(filter)} key={filter}>{filter === "week" ? "This Week" : filter[0].toUpperCase() + filter.slice(1)}</Link>)}</nav>{competitions.length > 1 ? <div className="competition-filters"><Link className={!competition ? "active" : ""} href={allCompetitionsHref}>All competitions</Link>{competitions.map((item) => <Link className={competition === item ? "active" : ""} href={href(active, item)} key={item}>{item}</Link>)}</div> : null}</div>;
}

export function KickoffSlotOffers({ predictions }: { predictions: PredictionView[] }) {
  const slots = new Map<string, { offer: FootballPredictionPreview["offers"][number]; matches: FootballPredictionPreview[] }>();
  for (const prediction of predictions) {
    if (!("locked" in prediction)) continue;
    for (const offer of prediction.offers.filter((item) => item.scopeType === "kickoff_slot")) {
      const slot = slots.get(offer.productId) ?? { offer, matches: [] };
      if (!slot.matches.some((item) => item.match_id === prediction.match_id)) slot.matches.push(prediction);
      slots.set(offer.productId, slot);
    }
  }
  const completeSlots = [...slots.values()].filter(({ offer, matches }) => offer.matchCount >= 2 && matches.length === offer.matchCount);
  if (!completeSlots.length) return null;
  return <section className="slot-market" aria-labelledby="slot-title"><div className="market-subheading"><div><p className="section-kicker">Multi-match access</p><h3 id="slot-title">Kickoff Slot Offers</h3></div><p>Unlock every listed match in one authoritative kickoff product.</p></div><div className="slot-grid">{completeSlots.map(({ offer, matches }) => <article className="kickoff-slot-card" key={offer.productId}><header><div><span>{matches[0].kickoff_at ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" }).format(new Date(matches[0].kickoff_at)) : "TBC"}</span><strong>Kickoff Slot</strong></div><b>{offer.matchCount} Matches</b></header><ul>{matches.map((match) => <li key={match.match_id}>{match.home_team} <span>vs</span> {match.away_team}</li>)}</ul><div className="slot-action"><div><span>Prematch</span><strong>{offer.priceAmount === null ? "Pricing unavailable" : formatProductPrice(offer.priceAmount, offer.currency)}</strong></div>{offer.priceAmount !== null ? <CheckoutButton offer={offer} matchLabel={`${offer.matchCount} match kickoff slot`} stage="Prematch" /> : <span className="coming-soon">Access coming soon</span>}</div></article>)}</div></section>;
}

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
    <article id={prediction.match_id ?? prediction.prediction_id} className="prediction-card unlocked-card">
      <header className="fixture-header"><div><span className="stage-badge prematch">Prematch · Unlocked</span><p>{prediction.competition}</p><h3>{prediction.home_team}<span>vs</span>{prediction.away_team}</h3><time dateTime={prediction.kickoff_at ?? undefined}>{kickoffLabel(prediction.kickoff_at)}</time></div><span className="unlock-state">✓ Unlocked</span></header>
      <div className="outcome-panel"><p>Most likely outcome</p><strong>{formatPredictedOutcome(prediction)}</strong>{prediction.predicted_score ? <span>Modeled score · {prediction.predicted_score.home}–{prediction.predicted_score.away}</span> : null}</div>
      <section className="probability-panel" aria-label="Model probabilities"><div className="card-label"><span>Chances / Model Probability</span><small>Higher = stronger likelihood</small></div><ProbabilityBars prediction={prediction} /></section>
      <section className="confidence-panel"><div><span>Confidence</span><strong>{formatReliability(prediction.reliability)}</strong></div><p>Confidence indicates how strongly the available evidence supports the model&apos;s preferred outcome. It is not a guarantee.</p></section>
      {prediction.customer_summary ? <p className="prediction-summary">{prediction.customer_summary}</p> : null}
      {factors.length ? <ul className="factor-list">{factors.map((factor) => <li key={factor}><span aria-hidden="true">✓</span>{factor}</li>)}</ul> : null}
      <PredictionDisclaimer />
      {prediction.match_id ? <Link className="match-detail-link" href={`/matches/${prediction.match_id}`}>Open living Prematch intelligence <span aria-hidden="true">→</span></Link> : null}
    </article>
  );
}

export function PredictionPreviewCard({ prediction }: { prediction: FootballPredictionPreview }) {
  const label = `${prediction.home_team} vs ${prediction.away_team}`;
  return (
    <article id={prediction.match_id ?? prediction.prediction_id} className="prediction-card locked-card">
      <header className="fixture-header"><div><span className="stage-badge prematch">Prematch · Available</span><p>{prediction.competition}</p><h3>{prediction.home_team}<span>vs</span>{prediction.away_team}</h3><time dateTime={prediction.kickoff_at ?? undefined}>{kickoffLabel(prediction.kickoff_at)}</time></div><span className="locked-state">◈ Locked</span></header>
      <div className="locked-preview"><span className="lock-icon" aria-hidden="true">◇</span><div><strong>Prediction available</strong><p>Unlock this stage to view the modeled outcome, probabilities, confidence and key match factors.</p><small>Locked · Match access required</small></div></div>
      <OfferList offers={prediction.offers} matchLabel={label} stage="Prematch" />
      {prediction.match_id ? <Link className="match-detail-link" href={`/matches/${prediction.match_id}`}>View match access <span aria-hidden="true">→</span></Link> : null}
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
    return { predictions: sortPredictionViews(views), failed: false } as const;
  } catch { return { predictions: [], failed: true } as const; }
}

export async function PredictionsContent({ limit, filter = "all", competition, showFilters = false, showSlots = true }: { limit?: number; filter?: UpcomingFilter; competition?: string; showFilters?: boolean; showSlots?: boolean } = {}) {
  await connection();
  const { predictions, failed } = await loadPredictions();
  if (failed) return <div className="service-state" role="alert">Predictions are temporarily unavailable. Please try again shortly.</div>;
  if (!predictions.length) return <PredictionEmptyState />;
  const competitions = [...new Set(predictions.map((prediction) => prediction.competition))].sort();
  const filtered = filterPredictionViews(predictions, filter, competition);
  const visible = typeof limit === "number" ? filtered.slice(0, limit) : filtered;
  if (!visible.length) return <>{showFilters ? <UpcomingFilters active={filter} competition={competition} competitions={competitions} /> : null}<PredictionEmptyState /></>;
  const groups = new Map<string, PredictionView[]>();
  for (const prediction of visible) {
    const label = fixtureDateLabel(prediction.kickoff_at);
    groups.set(label, [...(groups.get(label) ?? []), prediction]);
  }
  return <>{showFilters ? <UpcomingFilters active={filter} competition={competition} competitions={competitions} /> : null}{showSlots ? <KickoffSlotOffers predictions={filtered} /> : null}<div className="fixture-groups">{[...groups].map(([label, fixtures]) => <section key={label} aria-label={`${label} fixtures`}><div className="date-divider"><span>{label}</span><b>{fixtures.length} {fixtures.length === 1 ? "fixture" : "fixtures"}</b></div><div className="prediction-grid">{fixtures.map((prediction) => "locked" in prediction ? <PredictionPreviewCard key={prediction.prediction_id} prediction={prediction as FootballPredictionPreview} /> : <PredictionCard key={prediction.prediction_id} prediction={prediction as FootballPrediction} />)}</div></section>)}</div></>;
}
