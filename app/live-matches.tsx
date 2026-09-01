"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import {
  formatChangeReason,
  formatFootballStage,
  formatMatchMinute,
  formatPredictedOutcome,
  formatProbability,
  formatReliability,
  isActivelyLive,
} from "../lib/predictive-compass/presentation";
import {
  footballCustomerLiveMatchListSchema,
  footballPredictionHistorySchema,
  type FootballLiveMatch,
  type FootballLiveMatchView,
  type FootballPredictionHistory,
} from "../lib/predictive-compass/schema";
import {
  initialLiveMatchesState,
  chronologicalHistory,
  liveMatchesReducer,
  livePollDelay,
  shouldLoadHistory,
} from "../lib/predictive-compass/live-state";

function scoreLabel(match: FootballLiveMatchView) {
  if (!match.current_score) return `${match.home_team} vs ${match.away_team}`;
  return `${match.home_team} ${match.current_score.home} \u2013 ${match.current_score.away} ${match.away_team}`;
}

function predictionScoreLabel(match: FootballLiveMatch) {
  const score = match.latest_prediction?.predicted_score;
  if (!score) return "Unavailable";
  return `${match.home_team} ${score.home} \u2013 ${score.away} ${match.away_team}`;
}

function PredictionTimeline({ match }: { match: FootballLiveMatch }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<FootballPredictionHistory | null>(null);
  const [failed, setFailed] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const toggle = async () => {
    const opening = !open;
    setOpen(opening);
    if (!shouldLoadHistory(opening, Boolean(history), loading)) return;

    setLoading(true);
    setFailed(false);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await fetch(
        `/api/football/live/${encodeURIComponent(match.match_id)}/history`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok) throw new Error("history unavailable");
      setHistory(footballPredictionHistorySchema.parse(await response.json()));
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) setFailed(true);
    } finally {
      setLoading(false);
      controllerRef.current = null;
    }
  };

  const entries = history ? chronologicalHistory(history.history) : [];

  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <button
        className="text-sm font-semibold text-emerald-300 transition-colors hover:text-emerald-200"
        onClick={toggle}
        type="button"
        aria-expanded={open}
      >
        {open ? "Hide Prediction Timeline" : "View Prediction Changes"}
      </button>
      {open ? (
        <div className="mt-4">
          {loading ? <p className="text-sm text-slate-400">Loading prediction timeline…</p> : null}
          {failed ? <p className="text-sm text-amber-200">Prediction timeline is temporarily unavailable.</p> : null}
          {history && entries.length === 0 ? <p className="text-sm text-slate-400">No prediction changes are available yet.</p> : null}
          {entries.length ? (
            <ol className="space-y-4 border-l border-emerald-300/25 pl-4">
              {entries.map((entry, index) => {
                const minute = formatMatchMinute(entry.minute, null);
                const event = formatChangeReason(entry.change_reason);
                const heading = minute ?? formatFootballStage(entry.stage);
                return (
                  <li key={`${entry.generated_at ?? "entry"}-${index}`} className="relative">
                    <span className="absolute -left-[1.18rem] top-1.5 size-2 rounded-full bg-emerald-300" />
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {heading}{event && event !== heading ? ` \u00b7 ${event}` : ""}
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {formatPredictedOutcome({
                        predicted_outcome: entry.predicted_outcome,
                        home_team: match.home_team,
                        away_team: match.away_team,
                      })}
                      {" — "}
                      {formatProbability(
                        entry.predicted_outcome === "home_win"
                          ? entry.probabilities.home_win
                          : entry.predicted_outcome === "away_win"
                            ? entry.probabilities.away_win
                            : entry.probabilities.draw,
                      )}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{entry.change_description}</p>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function LiveMatchCard({ match }: { match: FootballLiveMatchView }) {
  if ("locked" in match) {
    const minute = formatMatchMinute(match.minute, match.added_time);
    const active = isActivelyLive(match.stage);
    return (
      <article className="rounded-2xl border border-emerald-300/20 bg-slate-950/70 p-5 shadow-xl shadow-emerald-950/20 sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">{match.competition}</p>
            <h3 className="mt-3 text-xl font-semibold text-white">{scoreLabel(match)}</h3>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">{minute ? `${minute} · ` : ""}{formatFootballStage(match.stage)}</p>
          </div>
          {active ? <span className="flex shrink-0 items-center gap-2 rounded-full bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-300"><span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />LIVE</span> : null}
        </div>
        <div className="py-6 text-center">
          <p className="text-sm font-semibold text-emerald-300">{match.prediction_available ? "Live prediction available" : "Live prediction is being prepared"}</p>
          <p className="mt-2 text-sm text-slate-400">Live intelligence and prediction timelines require Full Access.</p>
          <span className="mt-4 inline-flex rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300">Locked · Full Access</span>
        </div>
      </article>
    );
  }
  const prediction = match.latest_prediction;
  const minute = formatMatchMinute(match.minute, match.added_time);
  const active = isActivelyLive(match.stage);
  const outlookLabel = match.stage === "HALFTIME" ? "Second-half outlook" : "Our prediction";

  return (
    <article className="rounded-2xl border border-emerald-300/20 bg-slate-950/70 p-5 shadow-xl shadow-emerald-950/20 sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">{match.competition}</p>
          <h3 className="mt-3 text-xl font-semibold text-white">{scoreLabel(match)}</h3>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
            {minute ? `${minute} \u00b7 ` : ""}{formatFootballStage(match.stage)}
          </p>
        </div>
        {active ? <span className="flex shrink-0 items-center gap-2 rounded-full bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-300"><span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />LIVE</span> : null}
      </div>

      {prediction ? (
        <>
          <dl className="grid gap-5 py-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{outlookLabel}</dt>
              <dd className="mt-1 text-lg font-semibold text-emerald-300">{formatPredictedOutcome({ ...prediction, home_team: match.home_team, away_team: match.away_team })}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Most likely final score</dt>
              <dd className="mt-1 text-base font-medium text-slate-100">{predictionScoreLabel(match)}</dd>
            </div>
          </dl>
          <div className="border-t border-white/10 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Win chances</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-white/[0.05] px-2 py-3"><span className="block truncate text-slate-400">{match.home_team}</span><strong className="mt-1 block text-white">{formatProbability(prediction.probabilities.home_win)}</strong></div>
              <div className="rounded-xl bg-white/[0.05] px-2 py-3"><span className="block text-slate-400">Draw</span><strong className="mt-1 block text-white">{formatProbability(prediction.probabilities.draw)}</strong></div>
              <div className="rounded-xl bg-white/[0.05] px-2 py-3"><span className="block truncate text-slate-400">{match.away_team}</span><strong className="mt-1 block text-white">{formatProbability(prediction.probabilities.away_win)}</strong></div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Confidence</p>
            <p className="mt-1 font-semibold text-white">{formatReliability(prediction.reliability)}</p>
            <p className="mt-4 text-sm leading-6 text-slate-300">{prediction.customer_summary}</p>
            {prediction.customer_key_factors.length ? (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Why we picked it</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                  {prediction.customer_key_factors.map((factor) => <li className="flex gap-2" key={factor}><span aria-hidden="true" className="text-emerald-300">•</span><span>{factor}</span></li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </>
      ) : <p className="py-6 text-sm text-slate-400">The latest match prediction is being prepared.</p>}

      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-500">
        <span>Last updated</span><span>{minute ?? (match.updated_at ? new Date(match.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recently")}</span>
      </div>
      <PredictionTimeline match={match} />
    </article>
  );
}

export default function LiveMatches() {
  const [state, dispatch] = useReducer(liveMatchesReducer, initialLiveMatchesState);
  const matchesRef = useRef(state.matches);
  const controllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const refreshRef = useRef<(() => void) | null>(null);

  useEffect(() => { matchesRef.current = state.matches; }, [state.matches]);

  useEffect(() => {
    mountedRef.current = true;
    const refresh = async () => {
      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        const response = await fetch("/api/football/live", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("live update unavailable");
        const result = footballCustomerLiveMatchListSchema.parse(await response.json());
        if (mountedRef.current) {
          matchesRef.current = result.matches;
          dispatch({ type: "success", matches: result.matches });
        }
      } catch (error) {
        if (mountedRef.current && !(error instanceof Error && error.name === "AbortError")) {
          dispatch({ type: "failure" });
        }
      } finally {
        controllerRef.current = null;
        if (mountedRef.current) {
          timeoutRef.current = setTimeout(
            refresh,
            livePollDelay(matchesRef.current, document.hidden),
          );
        }
      }
    };
    refreshRef.current = () => { void refresh(); };
    void refresh();
    return () => {
      mountedRef.current = false;
      refreshRef.current = null;
      controllerRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <section id="live-matches" aria-labelledby="live-matches-title" className="mt-20 rounded-3xl border border-emerald-300/15 bg-emerald-300/[0.035] p-6 shadow-2xl shadow-black/20 sm:p-8 lg:mt-28 lg:p-10">
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Match centre</p><h2 id="live-matches-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Live Matches</h2></div>
        <button className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-emerald-300/50 hover:text-white" type="button" onClick={() => { if (!controllerRef.current) { if (timeoutRef.current) clearTimeout(timeoutRef.current); refreshRef.current?.(); } }}>Refresh</button>
      </div>
      {state.updateDelayed ? <p className="mt-5 rounded-xl bg-amber-300/10 px-4 py-3 text-sm text-amber-100" role="status">Live update temporarily delayed.</p> : null}
      {!state.hasLoaded ? <div className="flex min-h-48 items-center justify-center text-sm text-slate-400" role="status"><span className="mr-3 size-2 animate-pulse rounded-full bg-emerald-300" />Checking live matches…</div> : null}
      {state.hasLoaded && !state.matches.length ? <div className="flex min-h-48 items-center justify-center text-center text-slate-400">No matches are live right now.</div> : null}
      {state.matches.length ? <div className="grid gap-5 pt-6 lg:grid-cols-2">{state.matches.map((match) => <LiveMatchCard key={match.match_id} match={match} />)}</div> : null}
    </section>
  );
}
