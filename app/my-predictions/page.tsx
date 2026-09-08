import Link from "next/link";
import { CustomerShell, EmptyState, PageHeader } from "../customer-shell";
import { getCustomerAccess } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { formatProductPrice } from "@/lib/payments/format";
import { listCustomerMatches } from "@/lib/reports/post-match";

export const dynamic = "force-dynamic";

function activeHref(matchId:string,stages:string[]){if(stages.includes("prematch"))return `/matches/${matchId}`;if(stages.includes("live"))return `/live#${matchId}`;return `/halftime#${matchId}`}

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
        <h3>{match.homeTeam&&match.awayTeam?`${match.homeTeam} vs ${match.awayTeam}`:match.matchId}</h3>
        <p>{new Date(match.kickoffAt).toLocaleString("en-GB")} · {match.status}</p>
        <strong>✓ Unlocked</strong>
        <Link href={activeHref(match.matchId,match.purchasedStages)}>View Prediction →</Link>
      </article>)}</div>:<EmptyState title="No active predictions." description="Your purchased matches appear here until Core verifies the final result."/>}
    </section>
    <section className="owned-section">
      <div className="section-title"><h2>Completed Reports</h2><span>{completed.length}</span></div>
      {completed.length?<div className="completed-grid">{completed.map(match=><article className="completed-card" key={match.matchId}>
        <p>{match.competition}</p>
        <h3>{match.homeTeam} <span>{match.finalScore?.home} - {match.finalScore?.away}</span> {match.awayTeam}</h3>
        <time>{new Date(match.kickoffAt).toLocaleString("en-GB")}</time>
        <b>FINAL · Prediction Review Available</b>
        {match.amount!==null&&match.currency?<small>Purchased for {formatProductPrice(match.amount,match.currency)}</small>:<small>Free post-match report</small>}
        <div><Link href={`/my-predictions/${match.matchId}/report`}>View Report</Link><a href={`/api/reports/matches/${match.matchId}/pdf`}>Download PDF</a></div>
      </article>)}</div>:<EmptyState title="No completed reports yet." description="Every match appears here after Core verifies its official FINAL result."/>}
    </section>
  </CustomerShell>
}
