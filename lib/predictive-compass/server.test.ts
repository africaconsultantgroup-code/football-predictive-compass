import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createFootballCoreClient, CoreClientError } from "./server";

const apiKey = "football-service-secret";
const baseUrl = "https://core.example.test/";

const prediction = {
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
    expect(result[0]).not.toHaveProperty("model_version");
    expect(JSON.stringify(result)).not.toContain(apiKey);
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
