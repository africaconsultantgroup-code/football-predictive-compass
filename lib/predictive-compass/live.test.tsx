import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LiveMatchCard } from "../../app/live-matches";
import { createLiveListHandler, createLiveMatchHandler } from "./live-routes";
import {
  chronologicalHistory,
  initialLiveMatchesState,
  liveMatchesReducer,
  livePollDelay,
  shouldLoadHistory,
} from "./live-state";
import {
  formatChangeReason,
  formatFootballStage,
  formatPredictedOutcome,
} from "./presentation";
import type {
  FootballLiveMatch,
  FootballPredictionHistoryEntry,
  FootballStage,
} from "./schema";
import { createFootballCoreClient } from "./server";
import { capabilities, type CustomerAccess } from "../auth/access";
import { toLiveListPreview } from "./preview";

const apiKey = "live-football-service-secret";
const baseUrl = "https://core.example.test";
const matchId = `fm_${"a".repeat(32)}`;
const visitorAccess: CustomerAccess = { customer: null, subscription: null, capabilities: new Set() };
const freeAccess: CustomerAccess = { customer: { id: "free", email: "free@example.com" }, subscription: null, capabilities: new Set() };
const fullAccess: CustomerAccess = {
  customer: { id: "full", email: "full@example.com" },
  subscription: { name: "Full Access", endsAt: null },
  capabilities: new Set(Object.values(capabilities)),
};

const livePrediction = {
  predicted_outcome: "home_win" as const,
  predicted_score: { home: 2, away: 1 },
  probabilities: { home_win: 58.25, draw: 27, away_win: 14.75 },
  reliability: { score: 62.5, label: "Moderate" as const },
  verification_status: "verified",
  important_information_pending: false,
  customer_summary: "Arsenal retain the stronger outlook.",
  customer_key_factors: ["Arsenal have the highest result probability."],
};

function liveMatch(stage: FootballStage = "FIRST_HALF_LIVE"): FootballLiveMatch {
  return {
    match_id: matchId,
    competition: "Premier League",
    home_team: "Arsenal",
    away_team: "Chelsea",
    kickoff_at: "2026-09-01T18:00:00.000Z",
    status: stage === "FINAL" ? "FINISHED" : "IN_PLAY",
    minute: stage === "HALFTIME" ? 45 : stage === "FINAL" ? 90 : 34,
    added_time: null,
    current_score: { home: 1, away: stage === "HALFTIME" ? 1 : 0 },
    stage,
    latest_prediction: livePrediction,
    updated_at: "2026-09-01T18:34:00.000Z",
  };
}

function clientFor(status: number, body: unknown) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  return {
    fetchMock,
    client: createFootballCoreClient({ baseUrl, apiKey, fetch: fetchMock }),
  };
}

const historyEntry = (
  generatedAt: string,
  changeReason: FootballPredictionHistoryEntry["change_reason"],
): FootballPredictionHistoryEntry => ({
  stage: "FIRST_HALF_LIVE",
  minute: changeReason === "goal" ? 18 : 61,
  current_score: { home: 1, away: 0 },
  predicted_outcome: "home_win",
  predicted_score: { home: 2, away: 1 },
  probabilities: { home_win: 61, draw: 25, away_win: 14 },
  reliability: { score: 66, label: "Moderate" },
  generated_at: generatedAt,
  change_reason: changeReason,
  change_description:
    changeReason === "goal"
      ? "Prediction updated after a goal."
      : "Prediction updated after a red card.",
});

describe("live Core client", () => {
  it("uses x-api-key server-side and returns a sanitized live list", async () => {
    const internalMatch = {
      ...liveMatch(),
      internal_subject: "must-not-leave-core",
      latest_prediction: { ...livePrediction, model_version: "private" },
    };
    const { client, fetchMock } = clientFor(200, {
      domain: "football",
      matches: [internalMatch],
      database: "private",
    });
    const result = await client.getLiveFootballMatches();
    const [url, init] = fetchMock.mock.calls[0];

    expect(String(url)).toBe("https://core.example.test/api/v1/domains/football/matches/live");
    expect(new Headers(init?.headers).get("x-api-key")).toBe(apiKey);
    expect(init?.cache).toBe("no-store");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).not.toHaveProperty("internal_subject");
    expect(result.matches[0].latest_prediction).not.toHaveProperty("model_version");
    expect(JSON.stringify(result)).not.toContain(apiKey);
  });

  it("accepts zero live matches", async () => {
    const { client } = clientFor(200, { domain: "football", matches: [] });
    await expect(client.getLiveFootballMatches()).resolves.toEqual({
      domain: "football",
      matches: [],
    });
  });

  it.each([401, 403, 500])("handles live Core %s safely", async (status) => {
    const { client } = clientFor(status, { detail: "private upstream detail" });
    await expect(client.getLiveFootballMatches()).rejects.toMatchObject({
      kind: status === 401 ? "unauthorized" : status === 403 ? "forbidden" : "unavailable",
    });
  });

  it("rejects a malformed live response", async () => {
    const { client } = clientFor(200, {
      domain: "football",
      matches: [{ ...liveMatch(), minute: 999 }],
    });
    await expect(client.getLiveFootballMatches()).rejects.toMatchObject({ kind: "malformed" });
  });

  it("validates match IDs before requesting prediction details", async () => {
    const { client, fetchMock } = clientFor(200, {});
    await expect(client.getLiveFootballPrediction("../../private")).rejects.toMatchObject({ kind: "malformed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("same-origin live route boundary", () => {
  it("returns only supplied sanitized data and no credential", async () => {
    const handler = createLiveListHandler(async () => ({ domain: "football", matches: [] }), async () => fullAccess, capabilities.liveFull, (value) => value);
    const response = await handler();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain(apiKey);
  });

  it("handles upstream failure without exposing details", async () => {
    const handler = createLiveListHandler(async () => { throw new Error(`Core ${baseUrl} ${apiKey}`); }, async () => fullAccess, capabilities.liveFull, (value) => value);
    const response = await handler();
    const body = await response.text();
    expect(response.status).toBe(503);
    expect(body).not.toContain(apiKey);
    expect(body).not.toContain(baseUrl);
  });

  it("rejects an invalid match ID before invoking Core", async () => {
    const load = vi.fn();
    const response = await createLiveMatchHandler(load, async () => fullAccess, capabilities.liveFull)("not-a-match");
    expect(response.status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });

  it.each([visitorAccess, freeAccess])("returns preview data without protected live intelligence", async (access) => {
    const value = { domain: "football" as const, matches: [liveMatch()] };
    const handler = createLiveListHandler(async () => value, async () => access, capabilities.liveFull, (input) => toLiveListPreview(input as typeof value));
    const response = await handler();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.matches[0]).toMatchObject({ competition: "Premier League", prediction_available: true, locked: true });
    expect(body.matches[0]).not.toHaveProperty("latest_prediction");
    expect(JSON.stringify(body)).not.toMatch(/predicted_outcome|probabilities|reliability|customer_summary|customer_key_factors/);
  });

  it("returns full live intelligence only with live capability", async () => {
    const value = { domain: "football" as const, matches: [liveMatch()] };
    const response = await createLiveListHandler(async () => value, async () => fullAccess, capabilities.liveFull, () => null)();
    expect((await response.json()).matches[0].latest_prediction.probabilities.home_win).toBe(58.25);
  });

  it("returns 401 for visitors and 403 for free customers on premium detail", async () => {
    const load = vi.fn(async () => liveMatch());
    const visitor = await createLiveMatchHandler(load, async () => visitorAccess, capabilities.liveFull)(matchId);
    const free = await createLiveMatchHandler(load, async () => freeAccess, capabilities.liveFull)(matchId);
    expect(visitor.status).toBe(401);
    expect(free.status).toBe(403);
    expect(load).not.toHaveBeenCalled();
  });
});

describe("live state and polling", () => {
  it("updates the same match rather than duplicating it", () => {
    const oldMatch = liveMatch();
    const updatedMatch = { ...oldMatch, minute: 35 };
    const state = liveMatchesReducer(initialLiveMatchesState, {
      type: "success",
      matches: [oldMatch, updatedMatch],
    });
    expect(state.matches).toHaveLength(1);
    expect(state.matches[0].minute).toBe(35);
  });

  it("preserves the last good state after a failed poll", () => {
    const good = liveMatchesReducer(initialLiveMatchesState, {
      type: "success",
      matches: [liveMatch()],
    });
    const failed = liveMatchesReducer(good, { type: "failure" });
    expect(failed.matches).toEqual(good.matches);
    expect(failed.updateDelayed).toBe(true);
  });

  it("uses active, idle, hidden, and final polling intervals", () => {
    expect(livePollDelay([liveMatch()], false)).toBe(20_000);
    expect(livePollDelay([liveMatch("HALFTIME")], false)).toBe(20_000);
    expect(livePollDelay([], false)).toBe(60_000);
    expect(livePollDelay([liveMatch()], true)).toBe(60_000);
    expect(livePollDelay([liveMatch("FINAL")], false)).toBe(60_000);
  });

  it("loads history only when it is first requested", () => {
    expect(shouldLoadHistory(false, false, false)).toBe(false);
    expect(shouldLoadHistory(true, false, false)).toBe(true);
    expect(shouldLoadHistory(true, true, false)).toBe(false);
    expect(shouldLoadHistory(true, false, true)).toBe(false);
  });
});

describe("live customer presentation", () => {
  it.each([
    ["PREMATCH", "Pre-Match"],
    ["FIRST_HALF_LIVE", "First Half \u00b7 Live"],
    ["HALFTIME", "Half-Time"],
    ["SECOND_HALF_LIVE", "Second Half \u00b7 Live"],
    ["FINAL", "Full-Time"],
  ] as const)("maps %s to customer stage wording", (stage, label) => {
    expect(formatFootballStage(stage)).toBe(label);
  });

  it.each(["FIRST_HALF_LIVE", "HALFTIME", "SECOND_HALF_LIVE", "FINAL"] as const)(
    "renders %s without raw enums or changed Core values",
    (stage) => {
      const html = renderToStaticMarkup(<LiveMatchCard match={liveMatch(stage)} />);
      expect(html).toContain(formatFootballStage(stage));
      expect(html).not.toContain(stage);
      expect(html).toContain("58.25%");
      expect(html).toContain("27%");
      expect(html).toContain("14.75%");
      expect(html).toContain("Moderate");
      if (stage === "HALFTIME") expect(html).toContain("Second-half outlook");
    },
  );

  it("uses customer outcome wording", () => {
    expect(formatPredictedOutcome({ predicted_outcome: "home_win", home_team: "Arsenal", away_team: "Chelsea" })).toBe("Arsenal Win");
  });

  it("orders timeline entries chronologically and uses safe event labels", () => {
    const redCard = historyEntry("2026-09-01T19:01:00.000Z", "red_card");
    const goal = historyEntry("2026-09-01T18:18:00.000Z", "goal");
    expect(chronologicalHistory([redCard, goal])).toEqual([goal, redCard]);
    expect(formatChangeReason("goal")).toBe("Goal");
    expect(formatChangeReason("red_card")).toBe("Red Card");
    expect(formatChangeReason("interval_update")).toBeNull();
  });
});
