import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ensureProduct,
  eligibleLivePredictions,
  eligibleUpcomingPredictions,
  planPredictionProducts,
  type EligiblePrediction,
} from "./product-sync";
import type { FootballLiveMatch, FootballPrediction } from "../predictive-compass/schema";

const matchId = (letter: string) => `fm_${letter.repeat(32)}`;
const kickoff = "2026-09-05T14:00:00.000Z";

function eligible(id: string, stage: EligiblePrediction["stage"] = "prematch", kickoffAt = kickoff): EligiblePrediction {
  return { matchId: id, kickoffAt, competition: "Premier League", homeTeam: "Home", awayTeam: "Away", stage };
}

function upcoming(overrides: Partial<FootballPrediction> = {}): FootballPrediction {
  return {
    match_id: matchId("a"), prediction_id: "prediction-1", competition: "Premier League",
    home_team: "Arsenal", away_team: "Chelsea", kickoff_at: kickoff, stage: "PREMATCH",
    predicted_outcome: "home_win", predicted_score: null,
    probabilities: { home_win: 50, draw: 30, away_win: 20 },
    reliability: { score: 70, label: "High" }, verification_status: "verified",
    important_information_pending: false, customer_summary: "Available intelligence.",
    customer_key_factors: [], generated_at: null, updated_at: null, ...overrides,
  };
}

function live(overrides: Partial<FootballLiveMatch> = {}): FootballLiveMatch {
  return {
    match_id: matchId("a"), competition: "Premier League", home_team: "Arsenal",
    away_team: "Chelsea", kickoff_at: kickoff, status: "in_play", minute: 20,
    added_time: null, current_score: { home: 0, away: 0 }, stage: "FIRST_HALF_LIVE",
    latest_prediction: {
      predicted_outcome: "home_win", predicted_score: null,
      probabilities: { home_win: 50, draw: 30, away_win: 20 },
      reliability: { score: 70, label: "High" }, verification_status: "verified",
      important_information_pending: false, customer_summary: "Live intelligence.", customer_key_factors: [],
    }, updated_at: null, ...overrides,
  };
}

describe("automatic prediction product synchronization", () => {
  it("creates one deterministic match product from an eligible canonical prematch prediction", () => {
    const { eligible: records, skipped } = eligibleUpcomingPredictions([upcoming()]);
    const products = planPredictionProducts(records);
    expect(skipped).toBe(0);
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      syncKey: `core:prematch:match:${matchId("a")}`,
      scopeType: "match", stage: "prematch", salesCloseAt: kickoff,
      members: [{ match_id: matchId("a"), kickoff_at: kickoff }],
    });
    expect(planPredictionProducts(records)[0].syncKey).toBe(products[0].syncKey);
  });

  it("does not create another product when Core publishes a new prediction version", () => {
    const oldVersion = eligibleUpcomingPredictions([upcoming({ prediction_id: "version-1" })]).eligible;
    const newVersion = eligibleUpcomingPredictions([upcoming({ prediction_id: "version-2" })]).eligible;
    expect(planPredictionProducts(oldVersion)[0].syncKey).toBe(planPredictionProducts(newVersion)[0].syncKey);
  });

  it("skips missing canonical identity, invalid kickoff, non-prematch, and unavailable records", () => {
    const result = eligibleUpcomingPredictions([
      upcoming({ match_id: null }), upcoming({ kickoff_at: null }), upcoming({ stage: "FINAL" }),
    ]);
    expect(result).toEqual({ eligible: [], skipped: 3 });
  });

  it("creates live only with real live intelligence and reuses one live stage across both halves", () => {
    expect(eligibleLivePredictions([live({ latest_prediction: null })])).toMatchObject({ eligible: [], skipped: 1 });
    const first = eligibleLivePredictions([live()]).eligible;
    const second = eligibleLivePredictions([live({ stage: "SECOND_HALF_LIVE" })]).eligible;
    expect(first[0].stage).toBe("live");
    expect(planPredictionProducts(first)[0].syncKey).toBe(planPredictionProducts(second)[0].syncKey);
  });

  it("creates halftime only during halftime with actual intelligence", () => {
    const halftime = eligibleLivePredictions([live({ stage: "HALFTIME" })]);
    expect(halftime.eligible[0].stage).toBe("halftime");
    expect(planPredictionProducts(halftime.eligible)[0].syncKey).toBe(`core:halftime:match:${matchId("a")}`);
    expect(eligibleLivePredictions([live({ stage: "PREMATCH" })])).toMatchObject({ eligible: [], skipped: 1 });
  });

  it("reactivates the existing live product when second-half live returns", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const admin = {
      from(table: string) {
        expect(table).toBe("prediction_access_products");
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: { id: "live-product", price_amount: 25, is_active: false },
                    error: null,
                  }),
                };
              },
            };
          },
          update(values: Record<string, unknown>) {
            updates.push(values);
            return { eq: async () => ({ error: null }) };
          },
        };
      },
    };
    const spec = planPredictionProducts([
      eligible(matchId("a"), "live"),
    ])[0];
    const report = { created: 0, existing: 0, priced: 0, deactivated: 0, skipped: 0 };

    await ensureProduct(admin as never, spec, report);

    expect(report.existing).toBe(1);
    expect(updates).toEqual([{
      is_active: true,
      sales_open_at: spec.salesOpenAt,
      sales_close_at: spec.salesCloseAt,
    }]);
  });

  it("creates a slot only for at least two matches at the exact same UTC kickoff", () => {
    const two = planPredictionProducts([eligible(matchId("a")), eligible(matchId("b"))]);
    expect(two.filter((product) => product.scopeType === "kickoff_slot")).toHaveLength(1);
    expect(two.find((product) => product.scopeType === "kickoff_slot")?.members).toHaveLength(2);
    expect(planPredictionProducts([eligible(matchId("a"))]).some((product) => product.scopeType === "kickoff_slot")).toBe(false);
    expect(planPredictionProducts([
      eligible(matchId("a")), eligible(matchId("b"), "prematch", "2026-09-05T15:00:00.000Z"),
    ]).some((product) => product.scopeType === "kickoff_slot")).toBe(false);
  });

  it("creates a stable immutable fingerprint for a three-match slot", () => {
    const records = [eligible(matchId("a")), eligible(matchId("b")), eligible(matchId("c"))];
    const forward = planPredictionProducts(records).find((product) => product.scopeType === "kickoff_slot")!;
    const reverse = planPredictionProducts([...records].reverse()).find((product) => product.scopeType === "kickoff_slot")!;
    expect(forward.members).toHaveLength(3);
    expect(forward.syncKey).toBe(reverse.syncKey);
  });

  it("preserves purchased membership and historical rows while deactivating stale offers", () => {
    const source = readFileSync("lib/payments/product-sync.ts", "utf8");
    expect(source).toContain("if (lookup.data.price_amount !== null) return");
    expect(source).toContain("is_active: true");
    expect(source).toContain("update({ is_active: false })");
    expect(source).not.toMatch(/\.delete\(/);
    expect(source).not.toMatch(/prediction_id.*syncKey/);
  });

  it("uses database pricing and never generates a frontend or browser price", () => {
    const source = readFileSync("lib/payments/product-sync.ts", "utf8");
    expect(source).toContain("price_amount: null");
    expect(source).toContain("finalizePredictionAccessProduct(admin");
    expect(source).not.toMatch(/price_amount:\s*(20|25|30|35|50)/);
    const migration = readFileSync("supabase/migrations/20260903120407_automatic_prediction_product_sync.sql", "utf8");
    expect(migration).toContain("prediction_access_products_sync_key_unique");
  });

  it("does not truncate the commercially eligible homepage inventory", () => {
    const source = readFileSync("app/predictions.tsx", "utf8");
    expect(source).not.toMatch(/predictions\.slice\(0,\s*8\)/);
    expect(source).toContain('const visible = typeof limit === "number" ? filtered.slice(0, limit) : filtered;');
    expect(readFileSync("app/matches/page.tsx", "utf8")).not.toContain("limit=");
  });
});
