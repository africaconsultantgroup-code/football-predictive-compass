"use client";

import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
import { PredictionDisclaimer } from "./experience-components";

function scoreLabel(match: FootballLiveMatchView) {
  if (!match.current_score) return `${match.home_team} vs ${match.away_team}`;
  return `${match.home_team} ${match.current_score.home} \u2013 ${match.current_score.away} ${match.away_team}`;
}

function predictionScoreLabel(match: FootballLiveMatch) {
  const score = match.latest_prediction?.predicted_score;
  if (!score) return "Unavailable";
  return `${match.home_team} ${score.home} \u2013 ${score.away} ${match.away_team}`;
}

export function ownedMatchStage(matches: FootballLiveMatchView[], matchId: string) {
  return matches.find(match => match.match_id === matchId && match.stage !== "PREMATCH" && !("locked" in match));
}

export function PredictionTimeline({ match }: { match: FootballLiveMatch }) {
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
    <div id="timeline" className="prediction-timeline">
      <button
        className="timeline-toggle"
        onClick={toggle}
        type="button"
        aria-expanded={open}
      >
        <span aria-hidden="true">↻</span>{open ? "Hide Prediction Timeline" : "View Prediction Timeline"}<b aria-hidden="true">{open ? "−" : "+"}</b>
      </button>
      {open ? (
        <div className="mt-4">
          {loading ? <p className="timeline-message">Loading prediction timeline…</p> : null}
          {failed ? <p className="text-sm text-amber-800">Prediction timeline is temporarily unavailable.</p> : null}
          {history && entries.length === 0 ? <p className="timeline-message">No prediction changes are available yet.</p> : null}
          {entries.length ? (
            <ol className="timeline-list">
              {entries.map((entry, index) => {
                const minute = formatMatchMinute(entry.minute, null);
                if ("locked" in entry) {
                  return <li key={`${entry.generated_at ?? "entry"}-${index}`} className="timeline-entry locked"><span className="timeline-node" /><div><p>{minute ?? formatFootballStage(entry.stage)}</p><strong>◇ Locked</strong><small>Premium match access required</small></div></li>;
                }
                const event = formatChangeReason(entry.change_reason);
                const heading = minute ?? formatFootballStage(entry.stage);
                return (
                  <li key={`${entry.generated_at ?? "entry"}-${index}`} className="timeline-entry unlocked">
                    <span className="timeline-node" />
                    <div><p>
                      {heading}{event && event !== heading ? ` \u00b7 ${event}` : ""}
                    </p>
                    <strong>
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
                    </strong>
                    <small>{entry.change_description}</small></div>
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
      <article id={match.match_id} className={`prediction-card live-card locked-card ${match.stage === "HALFTIME" ? "halftime" : ""}`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{match.competition}</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-900">{scoreLabel(match)}</h3>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">{minute ? `${minute} · ` : ""}{formatFootballStage(match.stage)}</p>
          </div>
          {active ? <span className="flex shrink-0 items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1.5 text-xs font-bold text-blue-700"><span className="size-1.5 animate-pulse rounded-full bg-blue-600" />LIVE</span> : null}
        </div>
        <div className="py-6 text-center">
          <p className="text-sm font-semibold text-blue-700">{match.prediction_available ? "Live prediction available" : "Live prediction is being prepared"}</p>
          <p className="mt-2 text-sm text-slate-600">Live intelligence and prediction timelines are included in Premium Match Intelligence.</p>
          <span className="mt-4 inline-flex rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Locked · Match access required</span>
          <p className="mt-4 text-sm text-slate-600">Premium intelligence is available through your existing match access when supported.</p><Link className="matches-free-link" href={`/matches/${match.match_id}`}>View Match Intelligence</Link>
        </div>
      </article>
    );
  }
  const prediction = match.latest_prediction;
  const minute = formatMatchMinute(match.minute, match.added_time);
  const active = isActivelyLive(match.stage);
  const outlookLabel = match.stage === "HALFTIME" ? "Second-half outlook" : "Our prediction";

  return (
    <article id={match.match_id} className={`prediction-card live-card unlocked-card ${match.stage === "HALFTIME" ? "halftime" : ""}`}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{match.competition}</p>
          <h3 className="mt-3 text-xl font-semibold text-slate-900">{scoreLabel(match)}</h3>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">
            {minute ? `${minute} \u00b7 ` : ""}{formatFootballStage(match.stage)}
          </p>
        </div>
        {active ? <span className="flex shrink-0 items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1.5 text-xs font-bold text-blue-700"><span className="size-1.5 animate-pulse rounded-full bg-blue-600" />LIVE</span> : null}
      </div>

      {prediction ? (
        <>
          <dl className="grid gap-5 py-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{outlookLabel}</dt>
              <dd className="mt-1 text-lg font-semibold text-blue-700">{formatPredictedOutcome({ ...prediction, home_team: match.home_team, away_team: match.away_team })}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Most likely final score</dt>
              <dd className="mt-1 text-base font-medium text-slate-900">{predictionScoreLabel(match)}</dd>
            </div>
          </dl>
          <div className="border-t border-slate-200 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Win chances</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-blue-50 px-2 py-3"><span className="block truncate text-slate-600">{match.home_team}</span><strong className="mt-1 block text-slate-900">{formatProbability(prediction.probabilities.home_win)}</strong></div>
              <div className="rounded-xl bg-blue-50 px-2 py-3"><span className="block text-slate-600">Draw</span><strong className="mt-1 block text-slate-900">{formatProbability(prediction.probabilities.draw)}</strong></div>
              <div className="rounded-xl bg-blue-50 px-2 py-3"><span className="block truncate text-slate-600">{match.away_team}</span><strong className="mt-1 block text-slate-900">{formatProbability(prediction.probabilities.away_win)}</strong></div>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Confidence</p>
            <p className="mt-1 font-semibold text-slate-900">{formatReliability(prediction.reliability)}</p>
            <p className="mt-4 text-sm leading-6 text-slate-600">{prediction.customer_summary}</p>
            {prediction.customer_key_factors.length ? (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Why we picked it</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {prediction.customer_key_factors.map((factor) => <li className="flex gap-2" key={factor}><span aria-hidden="true" className="text-blue-700">•</span><span>{factor}</span></li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </>
      ) : <p className="py-6 text-sm text-slate-600">The latest match prediction is being prepared.</p>}

      <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
        <span>Last updated</span><span>{minute ?? (match.updated_at ? new Date(match.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recently")}</span>
      </div>
      <Link className="matches-free-link" href={`/matches/${match.match_id}`}>View Match Intelligence</Link>
      <PredictionTimeline match={match} />
      <PredictionDisclaimer />
    </article>
  );
}

export default function LiveMatches({ stage = "all", compact = false, embeddedHeading = true, matchId, children }: { matchId?: string; children?: ReactNode; stage?: "all" | "live" | "halftime"; compact?: boolean; embeddedHeading?: boolean } = {}) {
  const router = useRouter();
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
          // Refresh the same owned page as stronger pre-match information arrives.
          // Live snapshots continue through the existing polling path.
          if (matchId && !document.hidden && !ownedMatchStage(result.matches, matchId)) router.refresh();
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
  }, [matchId, router]);

  const filteredMatches = state.matches.filter((match) => (!matchId || match.match_id === matchId) && (stage === "all" ? true : stage === "halftime" ? match.stage === "HALFTIME" : match.stage === "FIRST_HALF_LIVE" || match.stage === "SECOND_HALF_LIVE"));
  if (matchId) {
    const current = ownedMatchStage(filteredMatches, matchId);
    return <section className="owned-match-lifecycle" aria-label="Owned match intelligence">
      {state.updateDelayed ? <p role="status">Match update temporarily delayed. Your access remains active.</p> : null}
      {current ? <><h2>{current.stage === "HALFTIME" ? "Second-Half Intelligence" : current.stage === "FINAL" ? "Final Match Intelligence" : "Live Match Intelligence"}</h2><LiveMatchCard match={current} /></> : children}
      <p>One match purchase includes every supported intelligence stage. No additional stage purchase is required.</p>
      <Link className="matches-free-link" href={`/my-predictions/${matchId}/report`}>View historical review</Link>
    </section>;
  }
  const visibleMatches = compact ? filteredMatches.slice(0, 3) : filteredMatches;
  const emptyTitle = stage === "halftime" ? "No matches are currently at halftime." : "No matches are live right now.";
  return (
    <section id="live-matches" aria-labelledby="live-matches-title" className="prediction-section live-section">
      {embeddedHeading ? <div className="flex items-center justify-between border-b border-slate-200 pb-6">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Match centre</p><h2 id="live-matches-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Live Matches</h2></div>
        <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-600/50 hover:text-slate-900" type="button" onClick={() => { if (!controllerRef.current) { if (timeoutRef.current) clearTimeout(timeoutRef.current); refreshRef.current?.(); } }}>Refresh</button>
      </div> : null}
      {state.updateDelayed ? <p className="mt-5 rounded-xl bg-amber-300/10 px-4 py-3 text-sm text-amber-800" role="status">Live update temporarily delayed.</p> : null}
      {!state.hasLoaded ? <div className="flex min-h-48 items-center justify-center text-sm text-slate-600" role="status"><span className="mr-3 size-2 animate-pulse rounded-full bg-blue-600" />Checking live matches…</div> : null}
      {state.hasLoaded && !visibleMatches.length ? <div className="customer-empty compact"><span aria-hidden="true">⌁</span><h2>{emptyTitle}</h2><p>Check Upcoming Matches for the next fixtures.</p><Link className="secondary-button" href="/matches">Explore Upcoming Matches</Link></div> : null}
      {visibleMatches.length ? <div className="prediction-grid">{visibleMatches.map((match) => <LiveMatchCard key={match.match_id} match={match} />)}</div> : null}
    </section>
  );
}
