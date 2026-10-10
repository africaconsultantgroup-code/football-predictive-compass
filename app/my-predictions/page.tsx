import Link from "next/link";
import { CustomerShell, EmptyState, PageHeader } from "../customer-shell";
import { getCustomerAccess } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { formatProductPrice } from "@/lib/payments/format";
import { listCustomerMatches } from "@/lib/reports/post-match";
import { fixtureTitle } from "@/lib/predictive-compass/fixture";
import { TeamIdentity } from "../team-identity";

export const dynamic = "force-dynamic";

function activeHref(matchId:string){return `/matches/${matchId}`}

export default async function MyPredictionsPage(){
  const user=await requireUser();
  const [access,matches]=await Promise.all([getCustomerAccess(),listCustomerMatches(user.id)]);
  const active=matches.filter(match=>match.purchased&&!match.isFinal);
  const completed=matches.filter(match=>match.isFinal);
  return <CustomerShell authenticated={Boolean(access.customer)}>
    <PageHeader eyebrow="Your intelligence" title="My Predictions" description="Active purchases and free retrospective reports for every completed match."/>
    <section className="owned-section">
      <div className="section-title"><h2>Active</h2><span>{active.length}</span></div>
      {active.length?<div className="owned-grid">{active.map(match=><article className="owned-card prematch" key={match.matchId}>
        <span className="stage-badge prematch">{match.purchasedStages.join(" · ")}</span>
        <p>{match.competition || "Competition being confirmed"}</p>
        <h3 className={match.homeTeam && match.awayTeam ? "sr-only" : undefined}>{fixtureTitle(match.homeTeam, match.awayTeam)}</h3>
        {match.homeTeam && match.awayTeam ? <div className="owned-teams"><TeamIdentity name={match.homeTeam} team={match.homeIdentity} /><span>vs</span><TeamIdentity name={match.awayTeam} team={match.awayIdentity} /></div> : null}
        <p>{new Date(match.kickoffAt).toLocaleString("en-GB")} · {match.status}</p>
        <strong>✓ Owned · Premium Intelligence</strong>
        <Link href={activeHref(match.matchId)}>View Match Intelligence →</Link>
      </article>)}</div>:<EmptyState title="No active predictions." description="Your purchased matches appear here until Core verifies the final result."/>}
    </section>
    <section className="owned-section">
      <div className="section-title"><h2>Completed Reports</h2><span>{completed.length}</span></div>
      {completed.length?<div className="completed-grid">{completed.map(match=><article className="completed-card" key={match.matchId}>
        <p>{match.competition}</p>
        <h3 className={match.homeTeam && match.awayTeam ? "sr-only" : undefined}>{fixtureTitle(match.homeTeam, match.awayTeam)}</h3>
        <div className="owned-teams"><TeamIdentity name={match.homeTeam} team={match.homeIdentity} /><span>{match.finalScore?.home} - {match.finalScore?.away}</span><TeamIdentity name={match.awayTeam} team={match.awayIdentity} /></div>
        <time>{new Date(match.kickoffAt).toLocaleString("en-GB")}</time>
        <b>Completed · Prediction Review Available</b>
        {match.amount!==null&&match.currency?<small>Purchased for {formatProductPrice(match.amount,match.currency)}</small>:<small>{match.purchased ? "Owned · Premium Intelligence" : "Free post-match report"}</small>}
        <div><Link href={`/my-predictions/${match.matchId}/report`}>View Report</Link><a href={`/api/reports/matches/${match.matchId}/pdf`}>Download PDF</a></div>
      </article>)}</div>:<EmptyState title="No completed reports yet." description="Every match appears here after Core verifies its official FINAL result."/>}
    </section>
  </CustomerShell>
}
