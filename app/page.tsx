import { Suspense } from "react";

import { PredictionsContent, PredictionsLoading } from "./predictions";
import LiveMatches from "./live-matches";
import { getCurrentUser } from "../lib/auth/session";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div id="home" className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 lg:px-8"
        >
          <a href="#home" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-300/10 text-sm font-semibold text-emerald-300">
              PC
            </span>
            <span className="text-sm font-semibold tracking-wide">
              Predictive Compass
            </span>
          </a>

          <div className="flex items-center gap-6 text-sm text-slate-300 sm:gap-8">
            <a className="transition-colors hover:text-white" href="#home">
              Home
            </a>
            <a
              className="transition-colors hover:text-white"
              href="#predictions"
            >
              Predictions
            </a>
            {user ? (
              <a className="rounded-full border border-white/15 px-4 py-2 font-medium text-white transition-colors hover:border-emerald-300/50 hover:bg-emerald-300/10" href="/account">Account</a>
            ) : (
              <div className="flex items-center gap-3">
                <a className="transition-colors hover:text-white" href="/login">Login</a>
                <a className="rounded-full border border-white/15 px-4 py-2 font-medium text-white transition-colors hover:border-emerald-300/50 hover:bg-emerald-300/10" href="/register">Register</a>
              </div>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col px-6 pb-20 pt-24 lg:px-8 lg:pt-32">
        <section className="max-w-3xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">
            Football intelligence, clearly guided
          </p>
          <h1 className="text-5xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl lg:text-7xl">
            Predictive Compass
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            Thoughtful football match predictions designed to help you see the
            game ahead with greater clarity.
          </p>
        </section>

        <LiveMatches />

        <section
          id="predictions"
          aria-labelledby="predictions-title"
          className="mt-20 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 sm:p-8 lg:mt-28 lg:p-10"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Match centre
              </p>
              <h2
                id="predictions-title"
                className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
              >
                Today&apos;s Predictions
              </h2>
            </div>
            <span className="hidden rounded-full bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-300 sm:block">
              Upcoming matches
            </span>
          </div>

          <Suspense fallback={<PredictionsLoading />}>
            <PredictionsContent />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
