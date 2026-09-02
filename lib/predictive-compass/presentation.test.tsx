import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { PredictionCard, PredictionPreviewCard } from "../../app/predictions";
import { OfferList, PredictionEmptyState } from "../../app/experience-components";
import { toPredictionPreview } from "./preview";
import type { FootballPrediction } from "./schema";
import { formatPredictedOutcome } from "./presentation";

const prediction: FootballPrediction = {
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
  customer_key_factors: [
    "Stronger recent away form",
    "More settled team",
    "Good record in this fixture",
  ],
  generated_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:05:00.000Z",
};

describe("customer prediction presentation", () => {
  it.each([
    ["home_win", "Aston Villa Win"],
    ["draw", "Draw"],
    ["away_win", "Arsenal Win"],
  ] as const)("turns %s into customer wording", (predicted_outcome, expected) => {
    expect(formatPredictedOutcome({ ...prediction, predicted_outcome })).toBe(expected);
  });

  it("displays exact H/D/A percentages, Core reliability, and up to three factors", () => {
    const html = renderToStaticMarkup(<PredictionCard prediction={prediction} />);

    expect(html).not.toContain("Aston Villa Win");
    expect(html).toContain("Arsenal Win");
    expect(html).toContain("32%");
    expect(html).toContain("26%");
    expect(html).toContain("42%");
    expect(html).toContain("Moderate");
    expect(html).toContain("Stronger recent away form");
    expect(html).toContain("More settled team");
    expect(html).toContain("Good record in this fixture");
    expect(html).not.toContain("model_version");
  });

  it("escapes customer-provided factor text", () => {
    const html = renderToStaticMarkup(
      <PredictionCard
        prediction={{
          ...prediction,
          customer_key_factors: ["<script>window.stolen = true</script>"],
        }}
      />,
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders a locked fixture preview without full prediction intelligence", () => {
    const preview = toPredictionPreview(prediction);
    const serialized = JSON.stringify(preview);
    const html = renderToStaticMarkup(<PredictionPreviewCard prediction={preview} />);
    expect(preview).toMatchObject({ competition: "Premier League", prediction_available: true, locked: true });
    expect(serialized).not.toMatch(/predicted_outcome|predicted_score|probabilities|reliability|customer_summary|customer_key_factors/);
    expect(html).toContain("Prediction available");
    expect(html).toContain("Locked · Match access required");
    expect(html).not.toContain("Arsenal Win");
    expect(html).not.toContain("42%");
  });

  it("renders a polished empty state without invented fixtures or prices", () => {
    const html = renderToStaticMarkup(<PredictionEmptyState />);
    expect(html).toContain("No prediction offers available right now.");
    expect(html).toContain("fixtures become eligible");
    expect(html).not.toMatch(/GH[₵¢]\s*\d|Arsenal|Chelsea/);
  });

  it("renders database-backed match and kickoff-slot prices and membership", () => {
    const html = renderToStaticMarkup(<OfferList matchLabel="Aston Villa vs Arsenal" stage="Prematch" offers={[
      { productId: "11111111-1111-1111-1111-111111111111", name: "Villa v Arsenal Prematch", scopeType: "match", priceAmount: 5, currency: "GHS", matchCount: 1 },
      { productId: "22222222-2222-2222-2222-222222222222", name: "19:00 Prematch Slot", scopeType: "kickoff_slot", priceAmount: 12, currency: "GHS", matchCount: 3 },
    ]} />);
    expect(html).toContain("GHS 5.00");
    expect(html).toContain("GHS 12.00");
    expect(html).toContain("Includes all 3 matches in this kickoff.");
    expect(html).toContain("Unlock Match");
    expect(html).toContain("Unlock Slot");
  });

  it("keeps probability and responsibility language visible on unlocked intelligence", () => {
    const html = renderToStaticMarkup(<PredictionCard prediction={prediction} />);
    expect(html).toContain("Chances / Model Probability");
    expect(html).toContain("Confidence indicates");
    expect(html).toContain("It is not a guarantee");
    expect(html).not.toMatch(/Guaranteed win|Sure prediction|100% accurate|Can.t lose|Certain outcome/i);
  });
});
