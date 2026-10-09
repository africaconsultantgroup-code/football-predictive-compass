import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createFootballCoreClient, CoreClientError } from "./server";

const apiKey = "football-service-secret";
const baseUrl = "https://core.example.test/";

const prediction = {
  match_id: "fm_0123456789abcdef0123456789abcdef",
  prediction_id: "pred-001",
  competition: "Premier League",
  home_team: "Aston Villa",
  away_team: "Arsenal",
  kickoff_at: "2026-09-02T19:00:00.000Z",
  stage: "PREMATCH",
  predicted_outcome: "away_win",
  predicted_score: { home: 0, away: 1 },
  probabilities: { home_win: 32, draw: 26, away_win: 42 },
  reliability: { score: 62, label: "Moderate" },
  verification_status: "verified",
  important_information_pending: false,
  customer_summary: "Arsenal have a narrow edge.",
  customer_key_factors: ["Stronger recent away form", "More settled team"],
  generated_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:05:00.000Z",
  model_version: "must-not-leave-core-boundary",
};

afterEach(() => vi.restoreAllMocks());

function clientWithResponse(status: number, body: unknown) {
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

describe("Football Core client", () => {
  it("accepts a 14.8-second stored inventory response without widening the freshness POST deadline", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(new Response(JSON.stringify({ predictions: [prediction] }))), 14_800);
        init?.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("aborted", "AbortError")); });
      }));
      const client = createFootballCoreClient({ baseUrl, apiKey, fetch: fetchMock });
      const inventory = client.getUpcomingFootballPredictions({ syncProducts: false });
      await vi.advanceTimersByTimeAsync(14_800);
      expect(await inventory).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const freshness = expect(client.requestPrematchFreshness(prediction.match_id)).rejects.toMatchObject({ kind: "timeout" });
      await vi.advanceTimersByTimeAsync(8_000);
      await freshness;
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
  it("recovers an upcoming timeout with one fresh no-store GET at the unchanged per-attempt deadline", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))); })).mockResolvedValueOnce(new Response(JSON.stringify({ predictions: [prediction] })));
    const client = createFootballCoreClient({ baseUrl, apiKey, fetch: fetchMock, timeoutMs: 1 });
    expect(await client.getUpcomingFootballPredictions({ syncProducts: false })).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) { expect(init?.method).toBe("GET"); expect(init?.cache).toBe("no-store"); }
  });
  it("does not retry authentication failures, invalid responses or freshness POSTs", async () => {
    for (const status of [401, 403]) {
      const { client, fetchMock } = clientWithResponse(status, {});
      await expect(client.getUpcomingFootballPredictions()).rejects.toBeInstanceOf(CoreClientError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
    const malformed = clientWithResponse(200, { predictions: [{ match_id: "bad" }] });
    await expect(malformed.client.getUpcomingFootballPredictions()).rejects.toMatchObject({ kind: "malformed" });
    expect(malformed.fetchMock).toHaveBeenCalledTimes(1);
    const freshness = clientWithResponse(503, {});
    await expect(freshness.client.requestPrematchFreshness(prediction.match_id)).rejects.toBeInstanceOf(CoreClientError);
    expect(freshness.fetchMock).toHaveBeenCalledTimes(1);
  });
  it("builds the authenticated upcoming request without putting the key in its URL", async () => {
    const { client, fetchMock } = clientWithResponse(200, { predictions: [] });
    await client.getUpcomingFootballPredictions();

    const [url, init] = fetchMock.mock.calls[0];
    const requestUrl = new URL(String(url));
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe(
      "https://core.example.test/api/v1/domains/football/predictions/upcoming",
    );
    expect(requestUrl.searchParams.has("from")).toBe(true);
    expect(requestUrl.searchParams.has("to")).toBe(true);
    expect(String(url)).not.toContain(apiKey);
    expect(new Headers(init?.headers).get("x-api-key")).toBe(apiKey);
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    expect(init?.cache).toBe("no-store");
  });

  it("returns successful, sanitized upcoming predictions", async () => {
    const { client } = clientWithResponse(200, { predictions: [prediction] });
    const result = await client.getUpcomingFootballPredictions();

    expect(result).toHaveLength(1);
    expect(result[0].prediction_id).toBe("pred-001");
    expect(result[0].match_id).toBe("fm_0123456789abcdef0123456789abcdef");
    expect(result[0]).not.toHaveProperty("model_version");
    expect(JSON.stringify(result)).not.toContain(apiKey);
  });

  it("requests Prematch freshness by canonical match on the server boundary", async () => {
    const { client, fetchMock } = clientWithResponse(200, {
      match_id: prediction.match_id,
      prediction,
      freshness_status: "stale",
      refresh_status: "queued",
      maximum_age_seconds: 600,
      snapshot_age_seconds: 900,
      internal_queue_id: "must-not-leak",
    });
    const result = await client.requestPrematchFreshness(prediction.match_id);
    const [url, init] = fetchMock.mock.calls[0];

    expect(String(url)).toBe(`https://core.example.test/api/v1/domains/football/matches/${prediction.match_id}/prematch/freshness`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("x-api-key")).toBe(apiKey);
    expect(result).not.toHaveProperty("internal_queue_id");
  });

  it("accepts an empty upcoming response", async () => {
    const { client } = clientWithResponse(200, { predictions: [] });
    await expect(client.getUpcomingFootballPredictions()).resolves.toEqual([]);
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [500, "unavailable"],
  ] as const)("maps Core %s safely", async (status, kind) => {
    const { client } = clientWithResponse(status, { internal_error: "secret detail" });
    await expect(client.getUpcomingFootballPredictions()).rejects.toMatchObject({ kind });
  });

  it("times out an unresponsive Core request", async () => {
    const fetchMock = vi.fn<typeof fetch>((_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
    );
    const client = createFootballCoreClient({
      baseUrl,
      apiKey,
      fetch: fetchMock,
      timeoutMs: 1,
    });

    await expect(client.getUpcomingFootballPredictions()).rejects.toEqual(
      new CoreClientError("timeout"),
    );
  });

  it("rejects malformed JSON", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("not-json", { status: 200 }),
    );
    const client = createFootballCoreClient({ baseUrl, apiKey, fetch: fetchMock });
    await expect(client.getUpcomingFootballPredictions()).rejects.toMatchObject({
      kind: "malformed",
    });
  });

  it("rejects a malformed prediction contract", async () => {
    const { client } = clientWithResponse(200, {
      predictions: [{ ...prediction, probabilities: { home_win: 132 } }],
    });
    await expect(client.getUpcomingFootballPredictions()).rejects.toMatchObject({
      kind: "malformed",
    });
  });
});
