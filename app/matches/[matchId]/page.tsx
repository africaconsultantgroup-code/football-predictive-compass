import LiveMatches from "../../live-matches";
import Link from "next/link";
import { TeamIdentity } from "../../team-identity";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { FreeMatchDetail } from "../free-detail";
import { getFreePrematchPrediction } from "../../../lib/predictive-compass/free-server";
import "../dashboard.css";
import "../free-detail.css";
import { PremiumMatchExperience } from "../premium-components";
import { hasSuccessfulPrematchPurchase } from "../../../lib/predictive-compass/premium-purchase";
import "../premium.css";
import { CustomerShell } from "../../customer-shell";
import { getCustomerAccess } from "../../../lib/auth/access";
import { getPredictionOffers, hasPredictionAccess } from "../../../lib/auth/match-access";
import { paidPrematchSnapshot, toPrematchReadiness, type PrematchReadiness } from "../../../lib/predictive-compass/prematch";
import { footballMatchIdSchema } from "../../../lib/predictive-compass/schema";
import { CoreClientError, getUpcomingFootballPredictions, requestPrematchFreshness, getPremiumFootballPrediction } from "../../../lib/predictive-compass/server";
import { createCustomerAuthServerClient } from "../../../lib/supabase/auth-server";
import { matchPricingV2Enabled } from "../../../lib/payments/pricing-version";

function formatKickoff(value: string | null) {
  if (!value) return "Kickoff time to be confirmed";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra", timeZoneName: "short" }).format(new Date(value));
}


export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  await connection();
  const parsed = footballMatchIdSchema.safeParse((await params).matchId);
  if (!parsed.success) notFound();

  let pageData;
  let authenticated = false;
  let premiumUnlocked = false;
  let purchased = false;
  try {
    const [access, supabase] = await Promise.all([getCustomerAccess(), createCustomerAuthServerClient()]);
    const unlocked = await hasPredictionAccess({ access, supabase, matchId: parsed.data, stage: "prematch" });
    authenticated = Boolean(access.customer);
    premiumUnlocked = unlocked;
    if (unlocked && access.customer) purchased = await hasSuccessfulPrematchPurchase(supabase, access.customer.id, parsed.data).catch(() => false);
    let freshness;
    try {
      freshness = await requestPrematchFreshness(parsed.data);
    } catch (error) {
      if (!(error instanceof CoreClientError) || !unlocked) throw error;
      const fallback = (await getUpcomingFootballPredictions()).find((item) => item.match_id === parsed.data && item.stage === "PREMATCH");
      if (!fallback?.kickoff_at || new Date(fallback.kickoff_at) <= new Date()) throw error;
      const readiness: PrematchReadiness = {
        match_id: parsed.data, competition: fallback.competition, home_team: fallback.home_team,
        away_team: fallback.away_team, kickoff_at: fallback.kickoff_at, home_team_identity: fallback.home_team_identity, away_team_identity: fallback.away_team_identity,
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
    const free = await getFreePrematchPrediction(parsed.data).catch(() => null);
    return <CustomerShell authenticated={authenticated} theme="matches"><div className="match-page"><Link className="back-link" href="/matches">← Upcoming Matches</Link>
      {free ? <><h1 className="team-identity-heading"><TeamIdentity inline name={free.home_team} team={free.home_team_identity} /><span>vs</span><TeamIdentity inline name={free.away_team} team={free.away_team_identity} /></h1><p>{free.competition} · {formatKickoff(free.kickoff_at)}</p></> : null}
      {premiumUnlocked ? <><div className="premium-access-state"><strong>Premium Intelligence Unlocked</strong>{purchased ? <span>Purchased ✓</span> : <span>Access active</span>}</div><LiveMatches matchId={parsed.data}><PremiumMatchExperience prediction={null} free={free} /></LiveMatches></> : <>{free ? <FreeMatchDetail free={free} unlocked={false} offers={[]} deliverable={false} /> : null}<div className="service-state" role="alert">Premium intelligence is temporarily unavailable. No payment can be started until a valid snapshot is ready.</div></>}
    </div></CustomerShell>;

  }

  const { readiness, access, unlocked, prediction, offers } = pageData;
  const free = await getFreePrematchPrediction(parsed.data, readiness);
  const label = `${readiness.home_team} vs ${readiness.away_team}`;
  let premium = null;
  if (unlocked && prediction) {
    try { premium = await getPremiumFootballPrediction(prediction.prediction_id, parsed.data); } catch { /* Preserve access; never relabel Free. */ }
  }
  const matchStatus = !readiness.kickoff_at ? "Kickoff to be confirmed" : new Date(readiness.kickoff_at) > new Date() ? "Upcoming · Pre-Match" : "Kickoff reached";
  return <CustomerShell authenticated={Boolean(access.customer)} theme="matches"><div className="match-page">
    <nav className="match-breadcrumb" aria-label="Breadcrumb"><Link href="/matches">Upcoming Matches</Link><span aria-hidden="true">›</span><span>{label}</span></nav>
    <section className="match-intelligence-header"><span className={unlocked ? "premium-badge" : "matches-summary-badge"}>{unlocked ? "PREMIUM MATCH INTELLIGENCE" : "FREE PRE-MATCH"}</span><h1 className="team-identity-heading"><TeamIdentity inline name={readiness.home_team} team={readiness.home_team_identity} /><span>vs</span><TeamIdentity inline name={readiness.away_team} team={readiness.away_team_identity} /></h1><p>{readiness.competition} · {formatKickoff(readiness.kickoff_at)}</p><p>{matchStatus}</p>{unlocked ? <div className="premium-access-state"><strong>Premium Intelligence Unlocked</strong>{purchased ? <span>Purchased ✓</span> : <span>Access active</span>}</div> : null}</section>
    {unlocked ? <LiveMatches matchId={parsed.data}><PremiumMatchExperience prediction={premium} free={free} updating={["queued", "in_progress"].includes(readiness.refresh_status)} /></LiveMatches> : free ? <FreeMatchDetail free={free} unlocked={false} offers={offers} deliverable={readiness.deliverable} pricingV2={matchPricingV2Enabled()} /> : null}
  </div></CustomerShell>;
}
