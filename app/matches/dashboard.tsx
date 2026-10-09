import { connection } from "next/server";
import { loadFreeUpcoming, sameFreeFixture } from "../../lib/predictive-compass/free-server";
import { CUSTOMER_COMPETITIONS, filterPredictionViews, sortPredictionViews, fixtureDateLabel, loadPredictions, type PredictionView, type UpcomingFilter } from "../predictions";
import { CompetitionTabs, DateSelector, MatchRow, FreeOnlyMatchRow } from "./match-components";
import type { FreePrematchPrediction } from "../../lib/predictive-compass/free";
import { MatchBasket } from "./match-basket";
import { reportInventory } from "../../lib/predictive-compass/inventory";
import { getCustomerAccess } from "../../lib/auth/access";
import { createCustomerAuthServerClient } from "../../lib/supabase/auth-server";
import { hasPredictionAccess } from "../../lib/auth/match-access";
import { InventoryRetry } from "../inventory-retry";
import { loadPendingMatchCheckouts } from "../../lib/payments/pending-checkout";
import type { PendingMatchCheckout } from "../../lib/payments/checkout-link";

export async function MatchesDashboard({ filter, competition }: { filter: UpcomingFilter; competition?: string }) {
  await connection();
  const selected = competition === "all" || !competition ? undefined : CUSTOMER_COMPETITIONS.find(item => item === competition) ?? CUSTOMER_COMPETITIONS[0];
  const [{ predictions, failed }, freeResult] = await Promise.all([loadPredictions(), loadFreeUpcoming()]);
  const freePredictions = freeResult.predictions;
  const freeFor = new Map(freePredictions.map(item => [item.match_id, item]));
  const premiumIds = new Set(predictions.map(item => item.match_id));
  const rows: (PredictionView | FreePrematchPrediction)[] = [...predictions, ...freePredictions.filter(item => !premiumIds.has(item.match_id))];
  const visible = filterPredictionViews(sortPredictionViews(rows), filter, selected);
  const freeOwnership = new Map<string, boolean>();
  let pendingCheckouts: PendingMatchCheckout[] = [];
  const freeOnly = visible.filter((item): item is FreePrematchPrediction => "tier" in item);
  if (rows.length) {
    try {
      const [access, supabase] = await Promise.all([getCustomerAccess(), createCustomerAuthServerClient()]);
      if (access.customer) pendingCheckouts = await loadPendingMatchCheckouts(supabase, access.customer.id).catch(() => []);
      await Promise.all(freeOnly.map(async item => {
        try { freeOwnership.set(item.match_id, await hasPredictionAccess({ access, supabase, matchId: item.match_id, stage: "prematch" })); }
        catch { reportInventory("access", "ACCESS_CHECK_FAILED"); }
      }));
    } catch { reportInventory("access", "ACCESS_CHECK_FAILED"); }
  }
  if (rows.length && !visible.length) reportInventory("filter", "FILTERED_TO_ZERO", rows.length);
  const now = new Date();
  const choices = predictions.filter(item => item.match_id && item.kickoff_at && item.stage === "PREMATCH" && Date.parse(item.kickoff_at) > now.getTime()).map(item => ({ matchId: item.match_id!, kickoffAt: item.kickoff_at!, label: `${item.competition}: ${item.home_team} vs ${item.away_team}`, owned: !("locked" in item), pendingCheckout: pendingCheckouts.find(pending => pending.matchIds.includes(item.match_id!)) }));
  const groups = new Map<string, typeof visible>();
  for (const prediction of visible) {
    const label = fixtureDateLabel(prediction.kickoff_at);
    groups.set(label, [...(groups.get(label) ?? []), prediction]);
  }
  const content = <div className="matches-dashboard">
    <div className="matches-toolbar"><CompetitionTabs selected={selected} filter={filter} /><DateSelector selected={selected} filter={filter} /></div>
    <div className="matches-heading"><div><p className="matches-eyebrow">Football intelligence</p><h1>{selected === "UEFA Champions League" ? "Champions League" : selected ?? "All competitions"}</h1><p>{visible.length ? `${visible.length} ${visible.length === 1 ? "match" : "matches"} · ${groups.size === 1 ? [...groups.keys()][0] : "Upcoming fixtures"}` : "Upcoming fixtures"}</p><span>Clear probabilities. Thoughtful decisions.</span></div></div>
    {(failed || freeResult.failed) && visible.length ? <div className="service-state" role="status"><p>Some intelligence is temporarily unavailable. Available fixtures remain below.</p><InventoryRetry /></div> : null}
    {(failed || freeResult.failed) && !visible.length ? <div className="matches-empty" role="alert"><h2>Match service temporarily unavailable</h2><p>Please try again shortly.</p><InventoryRetry /></div> : !visible.length ? <div className="matches-empty"><h2>{rows.length ? "No matches in this view" : "No upcoming matches currently available"}</h2><p>{rows.length ? "Try another date or competition." : "New fixtures will appear when the next schedule is available."}</p></div> : <div className="matches-fixtures">
      <div className="matches-columns" aria-hidden="true"><span>Match</span><span>Kickoff</span><span>Free Prediction</span><span>Premium Options</span></div>
      {[...groups].map(([date, fixtures]) => <section key={date} aria-label={`${date} fixtures`}><div className="matches-date-heading"><h2>{date}</h2><span>{fixtures.length} {fixtures.length === 1 ? "match" : "matches"}</span></div><div className="matches-rows">{fixtures.map(prediction => {
        if ("tier" in prediction) return <FreeOnlyMatchRow free={prediction} owned={freeOwnership.get(prediction.match_id)} key={prediction.match_id} />;
        const free = prediction.match_id ? freeFor.get(prediction.match_id) : undefined;
        return <MatchRow pricingV2 prediction={prediction} freePrediction={free && prediction.match_id && sameFreeFixture(free, { ...prediction, match_id: prediction.match_id }) ? free : undefined} key={prediction.prediction_id} />;
      })}</div></section>)}
    </div>}
    <p className="matches-disclaimer">Probabilities describe possible outcomes, not guarantees. All kickoff times are shown in Ghana time (GMT).</p>
  </div>;
  return <MatchBasket choices={choices}>{content}</MatchBasket>;
}
