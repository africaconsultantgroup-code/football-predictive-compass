import {Suspense} from "react";
import {connection} from "next/server";
import {getCustomerAccess} from "../../lib/auth/access";
import {createCustomerAuthServerClient} from "../../lib/supabase/auth-server";
import {loadPendingMatchCheckouts} from "../../lib/payments/pending-checkout";
import {loadFreeUpcoming} from "../../lib/predictive-compass/free-server";
import {unavailableFreePrematch} from "../../lib/predictive-compass/free";
import {firstAvailableInventory} from "../../lib/predictive-compass/first-inventory";
import {canonicalCompetition,reportInventory} from "../../lib/predictive-compass/inventory";
import {getUpcomingFootballPredictions} from "../../lib/predictive-compass/server";
import {toPredictionPreview} from "../../lib/predictive-compass/preview";
import {CUSTOMER_COMPETITIONS,filterPredictionViews,sortPredictionViews,fixtureDateLabel,loadPredictions,PredictionsLoading,type UpcomingFilter} from "../predictions";
import {MatchesDashboard,type DashboardSources} from "./dashboard";
import {CompetitionTabs,DateSelector,FreeOnlyMatchRow} from "./match-components";

type Props={filter:UpcomingFilter;competition?:string};

export async function AvailableMatches({filter,competition,sources}:{filter:UpcomingFilter;competition?:string;sources:Pick<DashboardSources,"premium"|"free">}) {
  const first=await firstAvailableInventory(sources.premium,sources.free);
  if(!first)return <PredictionsLoading/>;
  // The early shell uses only genuine identities and the dedicated Free DTO.
  // It never copies Premium probabilities into Free, infers ownership or offers
  // a payment before authoritative access/pending-checkout checks finish.
  const fixtures=first.source==="free"?first.predictions.slice():first.predictions.flatMap(p=>p.match_id?[unavailableFreePrematch({...p,match_id:p.match_id})]:[]);
  const selected=competition==="all"||!competition?undefined:CUSTOMER_COMPETITIONS.find(c=>c===competition)??CUSTOMER_COMPETITIONS[0];
  const visible=filterPredictionViews(sortPredictionViews(fixtures),filter,selected);
  const groups=new Map<string,typeof visible>();
  for(const fixture of visible){const date=fixtureDateLabel(fixture.kickoff_at);groups.set(date,[...(groups.get(date)??[]),fixture]);}
  return <div className="matches-dashboard" data-inventory-state="partial">
    <div className="matches-toolbar"><CompetitionTabs selected={selected} filter={filter}/><DateSelector selected={selected} filter={filter}/></div>
    <div className="matches-heading"><div><p className="matches-eyebrow">Football intelligence</p><h1>{selected??"All competitions"}</h1><p>{visible.length} {visible.length===1?"match":"matches"} available so far</p></div></div>
    <p className="matches-inventory-progress" role="status">Available fixtures are shown below. Remaining intelligence and access checks are loading.</p>
    {!visible.length?<p>Checking remaining fixtures for this view…</p>:<div className="matches-fixtures">{[...groups].map(([date,items])=><section key={date} aria-label={`${date} fixtures`}><div className="matches-date-heading"><h2>{date}</h2></div><div className="matches-rows">{items.map(free=><FreeOnlyMatchRow key={free.match_id} free={free} premiumLoading/>)}</div></section>)}</div>}
  </div>;
}

export async function ProgressiveMatchesDashboard(props:Props) {
  await connection();
  // One request-scoped access context, started beside inventory instead of twice
  // after inventory. It is never cached across requests or customers.
  const access=Promise.all([getCustomerAccess(),createCustomerAuthServerClient()]).then(([access,supabase])=>({access,supabase})).catch(()=>{reportInventory("access","ACCESS_CHECK_FAILED");return null;});
  const pending=access.then(context=>context?.access.customer&&!context.access.owner?loadPendingMatchCheckouts(context.supabase,context.access.customer.id).catch(()=>[]):[]);
  const inventory=getUpcomingFootballPredictions({syncProducts:false,retryInventory:false});
  const identity=inventory.then(predictions=>({predictions:predictions.map(p=>toPredictionPreview({...p,competition:canonicalCompetition(p.competition)},[])),failed:false as const,diagnostic:predictions.length?"INVENTORY_AVAILABLE" as const:"CORE_EMPTY" as const})).catch(()=>({predictions:[] as const,failed:true as const,diagnostic:"CORE_REQUEST_FAILED" as const}));
  const sources:DashboardSources={access,pending,premium:loadPredictions(access,{inventory}),free:loadFreeUpcoming({retryInventory:false})};
  const available=await AvailableMatches({...props,sources:{premium:identity,free:sources.free}});
  return <Suspense fallback={available}><MatchesDashboard {...props} sources={sources}/></Suspense>;
}
