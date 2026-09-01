import type {
  FootballLiveMatchView,
  FootballPredictionHistoryEntry,
  FootballLockedHistoryEntry,
} from "./schema";

export type LiveMatchesState = {
  matches: FootballLiveMatchView[];
  hasLoaded: boolean;
  updateDelayed: boolean;
};

export type LiveMatchesAction =
  | { type: "success"; matches: FootballLiveMatchView[] }
  | { type: "failure" };

export const initialLiveMatchesState: LiveMatchesState = {
  matches: [],
  hasLoaded: false,
  updateDelayed: false,
};

export function uniqueMatches(matches: FootballLiveMatchView[]) {
  return [...new Map(matches.map((match) => [match.match_id, match])).values()];
}

export function liveMatchesReducer(
  state: LiveMatchesState,
  action: LiveMatchesAction,
): LiveMatchesState {
  if (action.type === "failure") {
    return { ...state, hasLoaded: true, updateDelayed: true };
  }

  return {
    matches: uniqueMatches(action.matches),
    hasLoaded: true,
    updateDelayed: false,
  };
}

export function livePollDelay(matches: FootballLiveMatchView[], hidden: boolean) {
  if (hidden) return 60_000;
  return matches.some(
    (match) => match.stage !== "PREMATCH" && match.stage !== "FINAL",
  )
    ? 20_000
    : 60_000;
}

export function shouldLoadHistory(
  opening: boolean,
  hasHistory: boolean,
  loading: boolean,
) {
  return opening && !hasHistory && !loading;
}

export function chronologicalHistory(
  entries: Array<FootballPredictionHistoryEntry | FootballLockedHistoryEntry>,
) {
  return [...entries].sort((left, right) =>
    (left.generated_at ?? "").localeCompare(right.generated_at ?? ""),
  );
}
