import { connection } from "next/server";
import { getFreeUpcomingPredictions, sameFreeFixture } from "../../lib/predictive-compass/free-server";
import { CUSTOMER_COMPETITIONS, filterPredictionViews, sortPredictionViews, fixtureDateLabel, KickoffSlotOffers, loadPredictions, type PredictionView, type UpcomingFilter } from "../predictions";
import { CompetitionTabs, DateSelector, MatchdayPass, MatchRow, FreeOnlyMatchRow } from "./match-components";
import type { FreePrematchPrediction } from "../../lib/predictive-compass/free";
import { MatchBasket } from "./match-basket";
import { matchPricingV2Enabled } from "../../lib/payments/pricing-version";
import { getCustomerAccess } from "../../lib/auth/access";
import { createCustomerAuthServerClient } from "../../lib/supabase/auth-server";
import { ownsPremiumMatch } from "../../lib/auth/match-access";

export async function MatchesDashboard({ filter, competition }: { filter: UpcomingFilter; competition?: string }) {
  await connection();
  const v2 = matchPricingV2Enabled();
  const selected = competition === "all" || (v2 && !competition) ? undefined : CUSTOMER_COMPETITIONS.find(item => item === competition) ?? CUSTOMER_COMPETITIONS[0];
  const [{ predictions, failed }, freePredictions] = await Promise.all([loadPredictions(), getFreeUpcomingPredictions()]);
  const freeFor = new Map(freePredictions.map(item => [item.match_id, item]));
  const premiumIds = new Set(predictions.map(item => item.match_id));
  const rows: (PredictionView | FreePrematchPrediction)[] = [...predictions, ...freePredictions.filter(item => !premiumIds.has(item.match_id))];
  const visible = filterPredictionViews(sortPredictionViews(rows), filter, selected);
  const [access, customerClient] = v2 ? await Promise.all([getCustomerAccess(), createCustomerAuthServerClient()]) : [null, null];
  const now = new Date();
  const choices = v2 ? await Promise.all(predictions.filter(item => item.match_id && item.kickoff_at && item.stage === "PREMATCH" && Date.parse(item.kickoff_at) > now.getTime()).map(async item => ({ matchId: item.match_id!, kickoffAt: item.kickoff_at!, label: `${item.competition}: ${item.home_team} vs ${item.away_team}`, owned: !("locked" in item) || Boolean(access?.customer && customerClient && await ownsPremiumMatch(customerClient, access.customer.id, item.match_id!)) }))) : [];
  const groups = new Map<string, typeof visible>();
  for (const prediction of visible) {
    const label = fixtureDateLabel(prediction.kickoff_at);
    groups.set(label, [...(groups.get(label) ?? []), prediction]);
  }
  const content = <div className="matches-dashboard">
    <div className="matches-toolbar"><CompetitionTabs selected={selected} filter={filter} /><DateSelector selected={selected} filter={filter} /></div>
    <div className="matches-heading"><div><p className="matches-eyebrow">Football intelligence</p><h1>{selected === "UEFA Champions League" ? "Champions League" : selected ?? "All competitions"}</h1><p>{visible.length ? `${visible.length} ${visible.length === 1 ? "match" : "matches"} · ${groups.size === 1 ? [...groups.keys()][0] : "Upcoming fixtures"}` : "Upcoming fixtures"}</p><span>Clear probabilities. Thoughtful decisions.</span></div>{!v2 ? <MatchdayPass matchCount={visible.filter(item => item.stage === "PREMATCH").length} /> : null}</div>
    {failed && !visible.length ? <div className="matches-empty" role="alert"><h2>Matches are temporarily unavailable</h2><p>Please try again shortly.</p></div> : !visible.length ? <div className="matches-empty"><h2>No matches in this view</h2><p>Try another date or competition. New fixtures appear when predictions are available.</p></div> : <div className="matches-fixtures">
      <div className="matches-columns" aria-hidden="true"><span>Match</span><span>Kickoff</span><span>Free Prediction</span><span>Premium Options</span></div>
      {[...groups].map(([date, fixtures]) => <section key={date} aria-label={`${date} fixtures`}><div className="matches-date-heading"><h2>{date}</h2><span>{fixtures.length} {fixtures.length === 1 ? "match" : "matches"}</span></div><div className="matches-rows">{fixtures.map(prediction => {
        if ("tier" in prediction) return <FreeOnlyMatchRow free={prediction} key={prediction.match_id} />;
        const free = prediction.match_id ? freeFor.get(prediction.match_id) : undefined;
        return <MatchRow pricingV2={v2} prediction={prediction} freePrediction={free && prediction.match_id && sameFreeFixture(free, { ...prediction, match_id: prediction.match_id }) ? free : undefined} key={prediction.prediction_id} />;
      })}</div></section>)}
    </div>}
    {!failed && !v2 ? <KickoffSlotOffers predictions={visible.filter((item): item is PredictionView => !("tier" in item))} /> : null}
    <p className="matches-disclaimer">Probabilities describe possible outcomes, not guarantees. All kickoff times are shown in Ghana time (GMT).</p>
  </div>;
  return v2 ? <MatchBasket choices={choices}>{content}</MatchBasket> : content;
}
