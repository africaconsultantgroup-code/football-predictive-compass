import Link from "next/link";

import { getCustomerAccess, type CustomerAccess } from "../../lib/auth/access";
import { getActivePredictionGrants, type PredictionAccessSummary } from "../../lib/auth/match-access";
import { getCustomerProfile } from "../../lib/auth/profile";
import { requireUser, type CurrentCustomer } from "../../lib/auth/session";
import { getRecentPayments, type RecentPayment } from "../../lib/payments/service";
import { createCustomerAuthServerClient } from "../../lib/supabase/auth-server";
import { logoutAction } from "../auth-actions";
import { BrandMark } from "../experience-components";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export function AccountDetails({ user, displayName, access, predictionAccess = [], recentPayments = [] }: {
  user: CurrentCustomer;
  displayName: string | null;
  access: CustomerAccess;
  predictionAccess?: PredictionAccessSummary[];
  recentPayments?: RecentPayment[];
}) {
  const accessLabel = access.subscription?.name ?? "Free / Preview";
  return (
    <main className="account-shell">
      <nav className="account-nav"><Link href="/" className="brand"><BrandMark /><span><strong>Football</strong> Predictive Compass</span></Link><Link href="/#predictions">← Back to predictions</Link></nav>
      <section className="account-card">
        <header className="account-heading"><div><p className="section-kicker">Personal intelligence hub</p><h1>Customer Account</h1><p>Manage your profile and prediction access.</p></div><span className="account-status"><i />Account active</span></header>

        <section className="identity-panel" aria-labelledby="identity-title">
          <div className="account-section-title"><div><p className="section-kicker">Profile</p><h2 id="identity-title">Your Details</h2></div><ProfileForm displayName={displayName} /></div>
          <dl className="identity-grid"><div><dt>Name</dt><dd>{displayName ?? "Not provided"}</dd></div><div><dt>Email</dt><dd>{user.email ?? "Email unavailable"}</dd></div></dl>
        </section>

        <section className="summary-grid" aria-label="Account summary">
          <div><span>Prediction Access</span><strong>{predictionAccess.length}</strong><small>active {predictionAccess.length === 1 ? "grant" : "grants"}</small></div>
          <div><span>Recent Purchases</span><strong>{recentPayments.length}</strong><small>recorded purchases</small></div>
          <div><span>Access Status</span><strong className="summary-status">{accessLabel}</strong><small>{access.subscription?.endsAt ? `Until ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(access.subscription.endsAt))}` : "Current account level"}</small></div>
        </section>

        <section className="account-section"><div className="account-section-title"><div><p className="section-kicker">Your intelligence</p><h2>Prediction Access</h2></div><span>{predictionAccess.length} active</span></div>{predictionAccess.length ? <ul className="grant-grid">{predictionAccess.map((grant) => <li key={grant.productId}><span className={`stage-badge ${grant.stage}`}>{grant.stage}</span><p>{grant.name}</p><small>{grant.scopeType === "kickoff_slot" ? `${grant.matchCount} matches · Kickoff Slot` : "Single match"}</small><strong>✓ Unlocked</strong></li>)}</ul> : <div className="account-empty"><p>No prediction access purchased yet.</p><Link href="/#predictions">Browse Predictions →</Link></div>}</section>

        <section className="account-section"><div className="account-section-title"><div><p className="section-kicker">Payment activity</p><h2>Recent Purchases</h2></div></div>{recentPayments.length ? <ul className="purchase-list">{recentPayments.map((payment) => <li key={payment.id}><div><strong>{payment.name}</strong><span className="capitalize">{payment.stage} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(payment.createdAt))}</span></div><div><b>{payment.currency} {Number(payment.amount).toFixed(2)}</b><span className="capitalize">{payment.status}</span></div></li>)}</ul> : <div className="account-empty"><p>No purchases yet.</p><Link href="/#predictions">Explore Predictions →</Link></div>}</section>

        <footer className="account-footer"><p>Predictions are probability-based insights, not guaranteed outcomes.</p><div><span>Account Actions</span><form action={logoutAction}><button type="submit">Log out</button></form></div></footer>
      </section>
    </main>
  );
}

export default async function AccountPage() {
  const user = await requireUser();
  const customerClient = await createCustomerAuthServerClient();
  const [profile, access, predictionAccess, recentPayments] = await Promise.all([
    getCustomerProfile(customerClient, user.id), getCustomerAccess(), getActivePredictionGrants(customerClient, user.id), getRecentPayments(customerClient, user.id),
  ]);
  return <AccountDetails user={user} displayName={profile?.displayName ?? null} access={access} predictionAccess={predictionAccess} recentPayments={recentPayments} />;
}
