import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PredictionCard, PredictionPreviewCard } from "../../app/predictions";
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
});
