import { logoutAction } from "../auth-actions";
import { ProfileForm } from "./profile-form";
import { getCustomerProfile } from "../../lib/auth/profile";
import { requireUser } from "../../lib/auth/session";
import type { CurrentCustomer } from "../../lib/auth/session";
import { createCustomerAuthServerClient } from "../../lib/supabase/auth-server";
import { getCustomerAccess, type CustomerAccess } from "../../lib/auth/access";
import { getActivePredictionGrants, type PredictionAccessSummary } from "../../lib/auth/match-access";
import { getRecentPayments, type RecentPayment } from "../../lib/payments/service";
import Link from "next/link";
import { BrandMark, PredictionDisclaimer } from "../experience-components";

export const dynamic = "force-dynamic";

export function AccountDetails({
  user,
  displayName,
  access,
  predictionAccess = [],
  recentPayments = [],
}: {
  user: CurrentCustomer;
  displayName: string | null;
  access: CustomerAccess;
  predictionAccess?: PredictionAccessSummary[];
  recentPayments?: RecentPayment[];
}) {
  const planName = access.subscription?.name ?? "No active plan";
  const accessLabel = access.subscription?.name ?? "Free / Preview";
  return (
    <main className="account-shell">
      <nav className="account-nav"><Link href="/" className="brand"><BrandMark /><span><strong>Football</strong> Predictive Compass</span></Link><Link href="/">← Back to predictions</Link></nav>
      <section className="account-card">
        <div className="account-heading"><div><p className="section-kicker">Personal intelligence hub</p><h1>Customer Account</h1><p>Manage your profile and review prediction access.</p></div><span className="account-status"><i />Registered</span></div>
        <div className="account-identity">
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Name</p>
        <p className="mt-2 text-slate-200">{displayName ?? "Not provided"}</p>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Email</p>
        <p className="mt-2 text-slate-200">{user.email ?? "Email unavailable"}</p>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Subscription</p>
        <p className="mt-2 text-slate-200">{planName}</p>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Access</p>
        <p className="mt-2 text-slate-200">{accessLabel}</p>
        {access.subscription?.endsAt ? <><p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Access until</p><time className="mt-2 block text-slate-200" dateTime={access.subscription.endsAt}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(access.subscription.endsAt))}</time></> : null}</div>
        <div className="account-section"><div className="account-section-title"><div><p className="section-kicker">Your intelligence</p><h2>Prediction Access</h2></div><span>{predictionAccess.length} active</span></div>{predictionAccess.length ? <ul className="grant-grid">{predictionAccess.map((grant) => <li key={grant.productId}><span className={`stage-badge ${grant.stage}`}>{grant.stage}</span><p>{grant.name}</p><small>{grant.scopeType === "kickoff_slot" ? `${grant.matchCount} matches · Kickoff Slot` : "Single match"}</small><strong>✓ Unlocked</strong></li>)}</ul> : <div className="account-empty"><p>No purchased prediction access.</p><Link href="/#predictions">Explore available predictions →</Link></div>}</div>
        <div className="account-section"><div className="account-section-title"><div><p className="section-kicker">Payment activity</p><h2>Recent Purchases</h2></div></div>{recentPayments.length ? <ul className="purchase-list">{recentPayments.map((payment) => <li key={payment.id}><div><strong>{payment.name}</strong><span className="capitalize">{payment.stage} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(payment.createdAt))}</span></div><div><b>{payment.currency} {Number(payment.amount).toFixed(2)}</b><span className="capitalize">{payment.status}</span></div></li>)}</ul> : <div className="account-empty"><p>No purchases yet.</p></div>}</div>
        <ProfileForm displayName={displayName} />
        <PredictionDisclaimer />
        <form action={logoutAction} className="mt-10">
          <button className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold transition hover:border-emerald-300/50 hover:bg-emerald-300/10" type="submit">Log out</button>
        </form>
      </section>
    </main>
  );
}

export default async function AccountPage() {
  const user = await requireUser();
  const profile = await getCustomerProfile(
    await createCustomerAuthServerClient(),
    user.id,
  );
  const access = await getCustomerAccess();
  const customerClient = await createCustomerAuthServerClient();
  const [predictionAccess, recentPayments] = await Promise.all([getActivePredictionGrants(customerClient, user.id), getRecentPayments(customerClient, user.id)]);
  return <AccountDetails user={user} displayName={profile?.displayName ?? null} access={access} predictionAccess={predictionAccess} recentPayments={recentPayments} />;
}
