import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { MatchBasket, MatchSelection, SingleMatchCheckout } from "./match-basket";
import { MatchRow } from "./match-components";
import { toPredictionPreview } from "../../lib/predictive-compass/preview";
import { unavailableFreePrematch } from "../../lib/predictive-compass/free";
import type { FootballPrediction } from "../../lib/predictive-compass/schema";
const identity = { match_id:`fm_${"a".repeat(32)}`,competition:"EPL",home_team:"Home",away_team:"Away",kickoff_at:"2026-10-10T18:00:00Z" };
const choice = { matchId:identity.match_id,kickoffAt:identity.kickoff_at,label:"EPL: Home vs Away",owned:false };
describe("V2 customer pricing presentation", () => {
  it("shows selection, competition, Ghana kickoff, separate Free state and standard price without old passes", () => {
    const prediction = { ...identity,prediction_id:"internal",stage:"PREMATCH",probabilities:{home_win:58,draw:25,away_win:17} } as FootballPrediction;
    const html = renderToStaticMarkup(<MatchBasket choices={[choice]}><MatchRow prediction={toPredictionPreview(prediction)} freePrediction={unavailableFreePrematch(identity)} pricingV2 /></MatchBasket>);
    for (const expected of ["checkbox","EPL","18:00","GH₵8","Free prediction not available yet","Your Match Selection"]) expect(html).toContain(expected);
    for (const forbidden of ["58%","Matchday Pass","GHS 25","Full Match Intelligence"]) expect(html).not.toContain(forbidden);
  });
  it("marks owned matches Premium Unlocked and does not offer a checkbox", () => {
    const html = renderToStaticMarkup(<MatchBasket choices={[{...choice,owned:true}]}><MatchSelection matchId={identity.match_id} /></MatchBasket>);
    expect(html).toContain("Premium Unlocked"); expect(html).not.toContain("checkbox");
  });
  it("single-match purchase uses the same basket flow, with no stage-only price", () => {
    const html = renderToStaticMarkup(<SingleMatchCheckout matchId={identity.match_id} label="Home vs Away" />);
    expect(html).toContain("Unlock Premium Match — GH₵8"); expect(html).not.toContain("Prematch Prediction");
  });
});
