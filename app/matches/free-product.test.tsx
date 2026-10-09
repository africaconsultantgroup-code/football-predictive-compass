import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { createFreePrematchHandler, freePrematchSchema, unavailableFreePrematch } from "../../lib/predictive-compass/free";
import { FreeMatchDetail } from "./free-detail";
import { MatchRow, FreeOnlyMatchRow } from "./match-components";
import { toPredictionPreview } from "../../lib/predictive-compass/preview";
import type { FootballPrediction } from "../../lib/predictive-compass/schema";

const identity = { match_id: `fm_${"b".repeat(32)}`, competition: "Premier League", home_team: "Home FC", away_team: "Away FC", kickoff_at: "2026-10-10T14:00:00Z" };
// Synthetic contract fixture only; not a forecast source or production data.
const available = freePrematchSchema.parse({ ...identity, tier: "free", stage: "PREMATCH", status: "available", predicted_outcome: "home_win", probabilities: { home_win: 45, draw: 30, away_win: 25 }, generated_at: "2026-10-08T10:00:00Z" });
const offer = { productId: "real-offer", name: "Existing Premium", scopeType: "match" as const, priceAmount: 23, currency: "GHS", matchCount: 1 };

describe("Free pre-match product boundary", () => {
  it("allows anonymous retrieval of a valid dedicated free contract", async () => {
    const response = await createFreePrematchHandler(async () => available)(identity.match_id);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(available);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each(["confirmed_lineup", "availability_deltas", "world_state", "market_movement", "revision_triggers", "evidence", "combined", "champion", "unified", "market", "calibration", "shadow_forecast_id", "experiment_id", "candidate_policy_version"])("rejects forbidden field %s instead of leaking it", async field => {
    const response = await createFreePrematchHandler(async () => ({ ...available, [field]: "private" }))(identity.match_id);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
  });
  it("projects identity only from premium records, never their probabilities or summaries", async () => {
    const free = unavailableFreePrematch({ ...identity, probabilities: { home_win: 58, draw: 25, away_win: 17 }, customer_summary: "private", shadow: "private" } as typeof identity);
    const response = await createFreePrematchHandler(async () => free)(identity.match_id);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...identity, tier: "free", stage: "PREMATCH", status: "unavailable", probabilities: null, predicted_outcome: null, generated_at: null });
  });
  it("handles unknown IDs, invalid IDs and source outages safely", async () => {
    expect((await createFreePrematchHandler(async () => null)(identity.match_id)).status).toBe(404);
    expect((await createFreePrematchHandler(async () => available)("bad")).status).toBe(400);
    expect((await createFreePrematchHandler(async () => { throw new Error("secret"); })(identity.match_id)).status).toBe(503);
  });
  it("rejects malformed vectors and inconsistent outcomes", () => {
    expect(freePrematchSchema.safeParse({ ...available, probabilities: { home_win: 90, draw: 30, away_win: 25 } }).success).toBe(false);
    expect(freePrematchSchema.safeParse({ ...available, predicted_outcome: "draw" }).success).toBe(false);
  });
  it("rejects a valid forecast for a different match", async () => {
    expect((await createFreePrematchHandler(async () => available)(`fm_${"a".repeat(32)}`)).status).toBe(503);
  });
  it("renders dedicated free probabilities on list and detail without premium values", () => {
    const premium = { ...identity, prediction_id: "private-id", stage: "PREMATCH", predicted_outcome: "home_win", probabilities: { home_win: 58, draw: 25, away_win: 17 } } as FootballPrediction;
    const row = renderToStaticMarkup(<MatchRow prediction={toPredictionPreview(premium)} freePrediction={available} />);
    const detail = renderToStaticMarkup(<FreeMatchDetail free={available} unlocked={false} offers={[]} deliverable={false} />);
    for (const html of [row, detail]) { expect(html).toContain("45%"); expect(html).toContain("30%"); expect(html).toContain("25%"); expect(html).not.toContain("58%"); }
    expect(row).toContain("View Free Prediction");
    expect(detail).toContain("Home FC Win");
  });
  it("shows unavailable safely and uses Pricing V2 checkout", () => {
    const html = renderToStaticMarkup(<FreeMatchDetail free={unavailableFreePrematch(identity)} unlocked={false} offers={[offer]} deliverable />);
    expect(html).toContain("Free prediction not available yet");
    expect(html).toContain("GH₵8");
    expect(html).toContain("Unlock Premium");
    expect(html).not.toContain("58%");
    expect(html).not.toContain("GHS20");
  });
  it("never offers another purchase to an entitled customer or when delivery is blocked", () => {
    const paid = renderToStaticMarkup(<FreeMatchDetail free={available} unlocked offers={[offer]} deliverable />);
    expect(paid).toContain("Premium Intelligence Unlocked");
    expect(paid).not.toContain("unlock-button");
    const blocked = renderToStaticMarkup(<FreeMatchDetail free={available} unlocked={false} offers={[offer]} deliverable={false} />);
    expect(blocked).not.toContain("unlock-button");
  });
  it("renders a free-only fixture without inventing a premium ID or enabling checkout", () => {
    const html = renderToStaticMarkup(<FreeOnlyMatchRow free={available} />);
    expect(html).toContain("45%");
    expect(html).toContain("View Free Prediction");
    expect(html).toContain("View Premium Intelligence");
    expect(html).not.toContain("unlock-button");
    expect(html).not.toContain("private-id");
  });
});
