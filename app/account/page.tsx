import { logoutAction } from "../auth-actions";
import { ProfileForm } from "./profile-form";
import { getCustomerProfile } from "../../lib/auth/profile";
import { requireUser } from "../../lib/auth/session";
import type { CurrentCustomer } from "../../lib/auth/session";
import { createCustomerAuthServerClient } from "../../lib/supabase/auth-server";
import { getCustomerAccess, type CustomerAccess } from "../../lib/auth/access";
import { getActivePredictionGrants, type PredictionAccessSummary } from "../../lib/auth/match-access";
import { getRecentPayments, type RecentPayment } from "../../lib/payments/service";

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
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Football Predictive Compass</p>
        <h1 className="mt-3 text-3xl font-semibold">Customer Account</h1>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Name</p>
        <p className="mt-2 text-slate-200">{displayName ?? "Not provided"}</p>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Email</p>
        <p className="mt-2 text-slate-200">{user.email ?? "Email unavailable"}</p>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Account status</p>
        <p className="mt-2 text-slate-200">Registered</p>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Subscription</p>
        <p className="mt-2 text-slate-200">{planName}</p>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Access</p>
        <p className="mt-2 text-slate-200">{accessLabel}</p>
        {access.subscription?.endsAt ? <><p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Access until</p><time className="mt-2 block text-slate-200" dateTime={access.subscription.endsAt}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(access.subscription.endsAt))}</time></> : null}
        <div className="mt-8 border-t border-white/10 pt-6"><h2 className="text-lg font-semibold">Prediction Access</h2>{predictionAccess.length ? <ul className="mt-4 space-y-3">{predictionAccess.map((grant) => <li className="rounded-xl bg-white/[0.04] p-4" key={grant.productId}><p className="font-semibold text-white">{grant.name}</p><p className="mt-1 text-sm capitalize text-slate-300">{grant.stage} · {grant.scopeType === "kickoff_slot" ? `${grant.matchCount} matches` : "Single match"}</p><p className="mt-1 text-sm text-emerald-300">Unlocked</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-400">No purchased prediction access.</p>}</div>
        <div className="mt-8 border-t border-white/10 pt-6"><h2 className="text-lg font-semibold">Recent Purchases</h2>{recentPayments.length ? <ul className="mt-4 space-y-3">{recentPayments.map((payment) => <li className="rounded-xl bg-white/[0.04] p-4" key={payment.id}><p className="font-semibold text-white">{payment.name}</p><p className="mt-1 text-sm capitalize text-slate-300">{payment.stage} · {payment.currency} {Number(payment.amount).toFixed(2)}</p><p className="mt-1 text-sm capitalize text-slate-400">{payment.status} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(payment.createdAt))}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-400">No purchases yet.</p>}</div>
        <ProfileForm displayName={displayName} />
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
