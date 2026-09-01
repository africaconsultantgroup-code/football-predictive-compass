import { logoutAction } from "../auth-actions";
import { requireUser } from "../../lib/auth/session";
import type { CurrentCustomer } from "../../lib/auth/session";

export const dynamic = "force-dynamic";

export function AccountDetails({ user }: { user: CurrentCustomer }) {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Football Predictive Compass</p>
        <h1 className="mt-3 text-3xl font-semibold">My Account</h1>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Name</p>
        <p className="mt-2 text-slate-200">{user.displayName ?? "Not provided"}</p>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Email</p>
        <p className="mt-2 text-slate-200">{user.email ?? "Email unavailable"}</p>
        <form action={logoutAction} className="mt-10">
          <button className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold transition hover:border-emerald-300/50 hover:bg-emerald-300/10" type="submit">Log out</button>
        </form>
      </section>
    </main>
  );
}

export default async function AccountPage() {
  return <AccountDetails user={await requireUser()} />;
}
