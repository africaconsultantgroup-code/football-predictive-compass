import { describe, expect, it } from "vitest";

import { decidePredictionWrite } from "./freshness";
import { createPredictionReceiver } from "./receiver";
import type { PublicPrediction } from "./schema";
import { createPublicationSignature } from "./signature";

const secret = "test-only-publishing-secret-that-is-not-used-outside-tests";
const now = Date.parse("2026-08-30T12:00:00.000Z");
const timestamp = String(Math.floor(now / 1000));

const basePrediction: PublicPrediction = {
  public_prediction_id: "public-premier-league-001",
  league: "Premier League",
  home_team: "Northbridge FC",
  away_team: "Riverside United",
  kickoff_at: "2026-08-30T15:00:00.000Z",
  predicted_winner: "home",
  predicted_home_score: 2,
  predicted_away_score: 1,
  home_win_percentage: 52,
  draw_percentage: 27,
  away_win_percentage: 21,
  confidence_percentage: 72,
  customer_summary: "Northbridge hold a narrow advantage at home.",
  customer_key_factors: ["Strong recent home form", "Stable starting eleven"],
  publication_status: "published",
  source_updated_at: "2026-08-30T11:55:00.000Z",
  publication_version: 1,
  published_at: "2026-08-30T11:56:00.000Z",
};

function createMemoryStore() {
  const records = new Map<string, PublicPrediction>();

  return {
    records,
    async store(prediction: PublicPrediction) {
      const existing = records.get(prediction.public_prediction_id) ?? null;
      const decision = decidePredictionWrite(existing, prediction);

      if (decision === "create" || decision === "update") {
        records.set(prediction.public_prediction_id, prediction);
      }

      return decision;
    },
  };
}

function signedRequest(
  payload: Record<string, unknown>,
  options: { signature?: string; timestamp?: string } = {},
) {
  const rawBody = JSON.stringify(payload);
  const requestTimestamp = options.timestamp ?? timestamp;
  const signature =
    options.signature ??
    createPublicationSignature(requestTimestamp, rawBody, secret);

  return new Request("http://localhost/api/publications/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Predictive-Compass-Timestamp": requestTimestamp,
      "X-Predictive-Compass-Signature": `sha256=${signature}`,
    },
    body: rawBody,
  });
}

function setup() {
  const memoryStore = createMemoryStore();
  const receive = createPredictionReceiver({
    secret,
    store: memoryStore.store,
    now: () => now,
  });

  return { memoryStore, receive };
}

describe("prediction publication receiver", () => {
  it("accepts a valid signed request", async () => {
    const { receive } = setup();
    const response = await receive(signedRequest(basePrediction));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "create",
    });
  });

  it("rejects an invalid signature", async () => {
    const { memoryStore, receive } = setup();
    const response = await receive(
      signedRequest(basePrediction, { signature: "0".repeat(64) }),
    );

    expect(response.status).toBe(401);
    expect(memoryStore.records.size).toBe(0);
  });

  it("rejects a timestamp outside the five-minute window", async () => {
    const { memoryStore, receive } = setup();
    const staleTimestamp = String(Math.floor((now - 5 * 60 * 1000 - 1000) / 1000));
    const response = await receive(
      signedRequest(basePrediction, { timestamp: staleTimestamp }),
    );

    expect(response.status).toBe(401);
    expect(memoryStore.records.size).toBe(0);
  });

  it("rejects unknown fields", async () => {
    const { memoryStore, receive } = setup();
    const response = await receive(
      signedRequest({ ...basePrediction, model_internals: { score: 0.99 } }),
    );

    expect(response.status).toBe(400);
    expect(memoryStore.records.size).toBe(0);
  });

  it("handles duplicate predictions idempotently", async () => {
    const { memoryStore, receive } = setup();

    expect((await receive(signedRequest(basePrediction))).status).toBe(201);

    const duplicateResponse = await receive(signedRequest(basePrediction));

    expect(duplicateResponse.status).toBe(200);
    await expect(duplicateResponse.json()).resolves.toEqual({
      ok: true,
      status: "duplicate",
    });
    expect(memoryStore.records.size).toBe(1);
  });

  it("rejects a stale prediction update", async () => {
    const { memoryStore, receive } = setup();
    const currentPrediction = {
      ...basePrediction,
      publication_version: 2,
      source_updated_at: "2026-08-30T11:58:00.000Z",
    };

    expect((await receive(signedRequest(currentPrediction))).status).toBe(201);

    const staleResponse = await receive(signedRequest(basePrediction));

    expect(staleResponse.status).toBe(409);
    expect(
      memoryStore.records.get(basePrediction.public_prediction_id)
        ?.publication_version,
    ).toBe(2);
  });

  it("accepts a newer prediction update", async () => {
    const { memoryStore, receive } = setup();

    expect((await receive(signedRequest(basePrediction))).status).toBe(201);

    const newerPrediction = {
      ...basePrediction,
      publication_version: 2,
      source_updated_at: "2026-08-30T11:58:00.000Z",
      customer_summary: "Northbridge now have a stronger home advantage.",
    };
    const updateResponse = await receive(signedRequest(newerPrediction));

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toEqual({
      ok: true,
      status: "update",
    });
    expect(
      memoryStore.records.get(basePrediction.public_prediction_id)
        ?.publication_version,
    ).toBe(2);
  });
});
