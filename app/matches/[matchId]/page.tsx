import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { OfferList } from "@/app/experience-components";
import { PredictionCard } from "@/app/predictions";
import { SiteNavigation } from "@/app/site-navigation";
import { getCustomerAccess } from "@/lib/auth/access";
import { getPredictionOffers, hasPredictionAccess } from "@/lib/auth/match-access";
import { paidPrematchSnapshot, toPrematchReadiness, type PrematchReadiness } from "@/lib/predictive-compass/prematch";
import { footballMatchIdSchema } from "@/lib/predictive-compass/schema";
import { CoreClientError, getUpcomingFootballPredictions, requestPrematchFreshness } from "@/lib/predictive-compass/server";
import { createCustomerAuthServerClient } from "@/lib/supabase/auth-server";

function formatKickoff(value: string | null) {
  if (!value) return "Kickoff time to be confirmed";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra", timeZoneName: "short" }).format(new Date(value));
}

function readinessMessage(status: string) {
  if (status === "queued" || status === "in_progress") return "Checking new match information. The latest valid snapshot remains available to customers with access.";
  if (status === "completed") return "New match information has been incorporated.";
  if (status === "failed") return "The latest valid snapshot is being preserved while the next update is retried.";
  return "Prematch intelligence is checked against the latest available match information whenever this page opens.";
}

export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  await connection();
  const parsed = footballMatchIdSchema.safeParse((await params).matchId);
  if (!parsed.success) notFound();

  let pageData;
  try {
    const [access, supabase] = await Promise.all([getCustomerAccess(), createCustomerAuthServerClient()]);
    const unlocked = await hasPredictionAccess({ access, supabase, matchId: parsed.data, stage: "prematch" });
    let freshness;
    try {
      freshness = await requestPrematchFreshness(parsed.data);
    } catch (error) {
      if (!(error instanceof CoreClientError) || !unlocked) throw error;
      const fallback = (await getUpcomingFootballPredictions()).find((item) => item.match_id === parsed.data && item.stage === "PREMATCH");
      if (!fallback?.kickoff_at || new Date(fallback.kickoff_at) <= new Date()) throw error;
      const readiness: PrematchReadiness = {
        match_id: parsed.data, competition: fallback.competition, home_team: fallback.home_team,
        away_team: fallback.away_team, kickoff_at: fallback.kickoff_at,
        updated_at: fallback.last_intelligence_refresh_at ?? fallback.updated_at ?? fallback.generated_at ?? null,
        freshness_status: "unavailable", refresh_status: "failed", maximum_age_seconds: null,
        snapshot_age_seconds: null, deliverable: false,
      };
      pageData = { readiness, access, unlocked: true, prediction: fallback, offers: [] };
    }
    if (!freshness) {
      // A paid customer is using the last valid snapshot after a freshness failure.
    } else {
      const readiness = toPrematchReadiness(freshness);
      const prediction = unlocked ? paidPrematchSnapshot(freshness) : null;
      const offers = !unlocked && readiness.deliverable ? await getPredictionOffers(supabase, parsed.data, "prematch") : [];
      pageData = { readiness, access, unlocked, prediction, offers };
    }
  } catch (error) {
    if (error instanceof CoreClientError) pageData = null;
    else throw error;
  }

  if (!pageData) {
    return <div className="site-shell"><SiteNavigation authenticated={false} /><main className="site-main match-page"><Link className="back-link" href="/#upcoming-matches">← Back to upcoming matches</Link><div className="service-state" role="alert">Prematch intelligence is temporarily unavailable. No payment can be started until a valid snapshot is ready.</div></main></div>;
  }

  const { readiness, access, unlocked, prediction, offers } = pageData;
  const label = `${readiness.home_team} vs ${readiness.away_team}`;
  return <div className="site-shell"><SiteNavigation authenticated={Boolean(access.customer)} /><main className="site-main match-page">
    <Link className="back-link" href="/#upcoming-matches">← Back to upcoming matches</Link>
    <section className="match-intelligence-header"><p className="section-kicker">Living Prematch intelligence</p><h1>{readiness.home_team}<span>vs</span>{readiness.away_team}</h1><p>{readiness.competition} · {formatKickoff(readiness.kickoff_at)}</p><div className={`freshness-banner ${readiness.refresh_status}`} role="status"><strong>{readiness.freshness_status === "fresh" ? "Latest snapshot ready" : "Intelligence status checked"}</strong><span>{readinessMessage(readiness.refresh_status)}</span>{readiness.updated_at ? <time dateTime={readiness.updated_at}>Last intelligence update {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Accra" }).format(new Date(readiness.updated_at))}</time> : null}</div></section>
    {prediction ? <PredictionCard prediction={prediction} /> : unlocked ? <div className="service-state" role="alert">No valid Prematch snapshot is currently available. Your match access remains active and no new purchase is required.</div> : <section className="prediction-card locked-card living-access-card"><div className="locked-preview"><span className="lock-icon" aria-hidden="true">◇</span><div><strong>Prematch Prediction Available</strong><p>One match purchase unlocks the newest validated snapshot and its updates until kickoff.</p><small>Access follows this match, not a prediction version.</small></div></div>{readiness.deliverable ? <OfferList offers={offers} matchLabel={label} stage="Prematch" /> : <p className="offer-unavailable">Checkout is unavailable because a valid Prematch snapshot is not ready for delivery.</p>}</section>}
  </main></div>;
}
