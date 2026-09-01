import { connection } from "next/server";

import type { FootballPrediction } from "../lib/predictive-compass/schema";
import {
  formatPredictedOutcome,
  formatProbability,
  formatReliability,
} from "../lib/predictive-compass/presentation";
import { getUpcomingFootballPredictions } from "../lib/predictive-compass/server";
import { accessHasCapability, capabilities, getCustomerAccess } from "../lib/auth/access";
import { toPredictionPreview, type FootballPredictionPreview } from "../lib/predictive-compass/preview";

function kickoffLabel(kickoffAt: string | null) {
  if (!kickoffAt) return "Kickoff time to be confirmed";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(kickoffAt));
}

export function PredictionCard({ prediction }: { prediction: FootballPrediction }) {
  const factors = prediction.customer_key_factors.slice(0, 3);

  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/10 sm:p-6">
      <div className="border-b border-white/10 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
          {prediction.competition}
        </p>
        <h3 className="mt-3 text-xl font-semibold text-white">
          {prediction.home_team} <span className="text-slate-500">vs</span>{" "}
          {prediction.away_team}
        </h3>
        <time className="mt-2 block text-sm text-slate-400" dateTime={prediction.kickoff_at ?? undefined}>
          {kickoffLabel(prediction.kickoff_at)}
        </time>
      </div>

      <dl className="grid gap-5 py-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Our prediction</dt>
          <dd className="mt-1 text-lg font-semibold text-emerald-300">{formatPredictedOutcome(prediction)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Most likely score</dt>
          <dd className="mt-1 text-base font-medium text-slate-100">
            {prediction.predicted_score
              ? `${prediction.home_team} ${prediction.predicted_score.home} – ${prediction.predicted_score.away} ${prediction.away_team}`
              : "Unavailable"}
          </dd>
        </div>
      </dl>

      <div className="border-t border-white/10 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">How likely each result?</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-white/[0.05] px-2 py-3"><span className="block truncate text-slate-400">{prediction.home_team}</span><strong className="mt-1 block text-white">{formatProbability(prediction.probabilities.home_win)}</strong></div>
          <div className="rounded-xl bg-white/[0.05] px-2 py-3"><span className="block text-slate-400">Draw</span><strong className="mt-1 block text-white">{formatProbability(prediction.probabilities.draw)}</strong></div>
          <div className="rounded-xl bg-white/[0.05] px-2 py-3"><span className="block truncate text-slate-400">{prediction.away_team}</span><strong className="mt-1 block text-white">{formatProbability(prediction.probabilities.away_win)}</strong></div>
        </div>
      </div>

      <div className="border-t border-white/10 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Confidence</p>
        <p className="mt-1 font-semibold text-white">{formatReliability(prediction.reliability)}</p>
        {prediction.customer_summary ? <p className="mt-4 text-sm leading-6 text-slate-300">{prediction.customer_summary}</p> : null}
        {factors.length ? (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Why we picked it</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              {factors.map((factor) => <li className="flex gap-2" key={factor}><span aria-hidden="true" className="text-emerald-300">•</span><span>{factor}</span></li>)}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function PredictionPreviewCard({ prediction }: { prediction: FootballPredictionPreview }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/10 sm:p-6">
      <div className="border-b border-white/10 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">{prediction.competition}</p>
        <h3 className="mt-3 text-xl font-semibold text-white">{prediction.home_team} <span className="text-slate-500">vs</span> {prediction.away_team}</h3>
        <time className="mt-2 block text-sm text-slate-400" dateTime={prediction.kickoff_at ?? undefined}>{kickoffLabel(prediction.kickoff_at)}</time>
      </div>
      <div className="py-6 text-center">
        <p className="text-sm font-semibold text-emerald-300">Prediction available</p>
        <p className="mt-2 text-sm text-slate-400">Full prediction intelligence is available with Full Access.</p>
        <span className="mt-4 inline-flex rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300">Locked · Full Access</span>
      </div>
    </article>
  );
}

export function PredictionsLoading() {
  return <div className="flex min-h-64 items-center justify-center text-sm text-slate-400" role="status"><span className="mr-3 size-2 animate-pulse rounded-full bg-emerald-300" />Loading upcoming predictions…</div>;
}

async function loadPredictions() {
  try {
    const [predictions, access] = await Promise.all([
      getUpcomingFootballPredictions(),
      getCustomerAccess(),
    ]);
    const full = accessHasCapability(access, capabilities.prematchFull);
    return {
      predictions: full ? predictions : predictions.map(toPredictionPreview),
      full,
      failed: false,
    } as const;
  } catch {
    return { predictions: [], full: false, failed: true } as const;
  }
}

export async function PredictionsContent() {
  await connection();
  const { predictions, full, failed } = await loadPredictions();
  if (failed) {
    return <div className="flex min-h-64 items-center justify-center text-center text-slate-400" role="alert">Predictions are temporarily unavailable. Please try again shortly.</div>;
  }
  if (!predictions.length) {
    return <div className="flex min-h-64 items-center justify-center text-center text-slate-400">No upcoming predictions are available right now.</div>;
  }
  return <div className="grid gap-5 pt-6 lg:grid-cols-2">{full
    ? (predictions as FootballPrediction[]).map((prediction) => <PredictionCard key={prediction.prediction_id} prediction={prediction} />)
    : (predictions as FootballPredictionPreview[]).map((prediction) => <PredictionPreviewCard key={prediction.prediction_id} prediction={prediction} />)
  }</div>;
}
