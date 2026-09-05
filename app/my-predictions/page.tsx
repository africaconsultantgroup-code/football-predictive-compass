import Link from "next/link";

import { getCustomerAccess } from "@/lib/auth/access";
import { getActivePredictionGrants, type PredictionAccessSummary } from "@/lib/auth/match-access";
import { requireUser } from "@/lib/auth/session";
import { getRecentPayments } from "@/lib/payments/service";
import { createCustomerAuthServerClient } from "@/lib/supabase/auth-server";
import { CustomerShell, EmptyState, PageHeader } from "../customer-shell";

function grantHref(grant: PredictionAccessSummary) {
  const matchId = grant.matches[0]?.matchId;
  if (!matchId) return "/my-predictions";
  return grant.stage === "prematch" ? `/matches/${matchId}` : `/${grant.stage}#${matchId}`;
}

function AccessSection({ title, grants }: { title: string; grants: PredictionAccessSummary[] }) {
  if (!grants.length) return null;
  return <section className="owned-section"><div className="section-title"><h2>{title}</h2><span>{grants.length}</span></div><div className="owned-grid">{grants.map((grant) => <article className={`owned-card ${grant.stage}`} key={grant.productId}><span className={`stage-badge ${grant.stage}`}>{grant.stage}</span><h3>{grant.name}</h3><p>{grant.scopeType === "kickoff_slot" ? `${grant.matchCount} match package` : "Single match access"}</p><strong>✓ Unlocked</strong><Link href={grantHref(grant)}>View Prediction →</Link></article>)}</div></section>;
}

export default async function MyPredictionsPage() {
  const user = await requireUser();
  const client = await createCustomerAuthServerClient();
  const [access, grants, payments] = await Promise.all([getCustomerAccess(), getActivePredictionGrants(client, user.id), getRecentPayments(client, user.id)]);
  const prematch = grants.filter((grant) => grant.stage === "prematch");
  const live = grants.filter((grant) => grant.stage === "live");
  const halftime = grants.filter((grant) => grant.stage === "halftime");
  const past = payments.filter((payment) => payment.status === "successful");
  return <CustomerShell authenticated={Boolean(access.customer)}><PageHeader eyebrow="Your intelligence" title="My Predictions" description="Return to predictions you have unlocked across every match stage." />
    {!grants.length && !payments.length ? <EmptyState title="You haven't unlocked a prediction yet." description="Choose an upcoming match to access its latest Prematch intelligence." href="/matches" action="Explore Upcoming Matches" /> : <><AccessSection title="Active Prematch" grants={prematch} /><AccessSection title="Live Access" grants={live} /><AccessSection title="Halftime Access" grants={halftime} />{past.length ? <section className="owned-section"><div className="section-title"><h2>Past Purchases</h2><span>{past.length}</span></div><div className="purchase-archive">{past.map((payment) => <article key={payment.id}><span className={`stage-badge ${payment.stage}`}>{payment.stage}</span><h3>{payment.name}</h3><p>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(payment.createdAt))} · {payment.currency} {Number(payment.amount).toFixed(2)}</p><strong>{payment.status}</strong></article>)}</div></section> : null}</>}
  </CustomerShell>;
}
