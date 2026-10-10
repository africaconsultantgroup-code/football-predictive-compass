import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { toPredictionPreview } from "../../lib/predictive-compass/preview";
import type { FootballPrediction } from "../../lib/predictive-compass/schema";
import { CompetitionTabs, DateSelector, MatchRow } from "./match-components";

const prediction: FootballPrediction = {
  match_id: `fm_${"a".repeat(32)}`, prediction_id: "test-prediction", competition: "Premier League",
  home_team: "Home FC", away_team: "Away FC", kickoff_at: "2026-10-10T14:00:00Z", stage: "PREMATCH",
  predicted_outcome: "home_win", predicted_score: null, probabilities: { home_win: 58, draw: 25, away_win: 17 },
  reliability: { score: 60, label: "Moderate" }, verification_status: "verified", important_information_pending: false,
  customer_summary: "Protected summary", customer_key_factors: [], generated_at: null, updated_at: null,
};

describe("Matches dashboard access and product boundaries", () => {
  it("offers an owner a direct Premium link without payment controls",()=>{
    const html=renderToStaticMarkup(<MatchRow owner prediction={prediction}/>);
    expect(html).toContain("Premium Unlocked");expect(html).toContain("View Premium Intelligence");
    expect(html).not.toContain("Add to Basket");expect(html).not.toContain("GH₵8");
  });
  it("keeps premium probabilities out of the free summary even with paid access", () => {
    const html = renderToStaticMarkup(<MatchRow prediction={prediction} />);
    expect(html).not.toContain("58%");
    expect(html).not.toContain("25%");
    expect(html).not.toContain("17%");
    expect(html).toContain(`/matches/${prediction.match_id}`);
    expect(html).toContain("Unlocked");
    expect(html).not.toContain("Unlock Prematch Prediction");
  });

  it("keeps protected values out of locked markup and uses the Pricing V2 authority", () => {
    const preview = toPredictionPreview(prediction, [{ productId: "real-product", name: "Prematch", scopeType: "match", priceAmount: 23, currency: "GHS", matchCount: 1 }]);
    const html = renderToStaticMarkup(<MatchRow prediction={preview} />);
    expect(html).not.toContain("58%");
    expect(html).not.toContain("Protected summary");
    expect(html).not.toContain("Most Likely:");
    expect(html).toContain("GH₵8");
    expect(html).not.toContain("GH₵23.00");
    expect(html).not.toContain("Unlock Prematch Prediction");
    expect(html).toContain("View Free Prediction");
    expect(html).not.toContain("preview pricing");
  });

  it("disables purchasing after kickoff instead of rendering a dead checkout link", () => {
    const html = renderToStaticMarkup(<MatchRow prediction={toPredictionPreview({ ...prediction, kickoff_at: "2020-01-01T12:00:00Z" })} />);
    expect(html).not.toContain("Unlock Prematch Prediction");
    expect(html).toContain("Purchasing has closed for this match");
    expect(html).toContain('disabled=""'); expect(html).not.toContain("Add to Basket");
    expect(html).not.toContain("Matchday Pass");
    expect(html).not.toContain("preview pricing");
  });

  it("retains FINAL state and handles absent kickoff and match IDs", () => {
    const html = renderToStaticMarkup(<MatchRow prediction={{ ...prediction, stage: "FINAL", kickoff_at: null, match_id: null }} />);
    expect(html).toContain("Full-Time");
    expect(html).toContain("TBC");
    expect(html).toContain("Match details unavailable");
    expect(html).toContain("Completed");
    expect(html).not.toContain("/matches/null");
  });

  it("keeps competition and date filters together and disables unsupported leagues", () => {
    const tabs = renderToStaticMarkup(<CompetitionTabs filter="tomorrow" selected="Premier League" />);
    expect(tabs).toContain("filter=tomorrow&amp;competition=UEFA+Champions+League");
    expect(tabs).toContain('disabled=""');
    expect(tabs).not.toContain("competition=La+Liga");
    const dates = renderToStaticMarkup(<DateSelector filter="today" selected="Premier League" />);
    expect(dates).toContain("filter=week&amp;competition=Premier+League");
  });
});
