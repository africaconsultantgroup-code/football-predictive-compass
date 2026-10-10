import {describe,it,expect,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
vi.mock("server-only",()=>({}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
import captured from "../../lib/predictive-compass/arsenal-leeds-premium.fixture.json";
import {normalizePremiumAvailability,premiumCustomerSchema} from "../../lib/predictive-compass/premium";
import {PremiumMatchExperience} from "./premium-components";
import LiveMatches from "../live-matches";

describe("Arsenal vs Leeds captured Core DTO UI acceptance",()=>{
 // Contract example from the requested acceptance values, never a production source.
 it("renders completed contract fields verbatim without deriving intelligence",()=>{
  const base=premiumCustomerSchema.parse(normalizePremiumAvailability(captured));
  const dto=premiumCustomerSchema.parse({...base,premium_intelligence:{...base.premium_intelligence,
   score_forecast:{status:"available",most_likely_score:{home:2,away:0},score_probability:10.6,alternative_scorelines:[]},
   intelligence_reasons:[{category:"Player Availability",summary:"Core-supplied player availability explanation."}],
   forecast_change:{available:true,free_leading_outcome:"home_win",free_probability:54,premium_leading_outcome:"home_win",premium_probability:55.95,probability_point_change:1.95,leading_outcome_changed:false,reasons:["Core-supplied forecast change explanation."]},
   availability:{...base.premium_intelligence.availability,score_forecast:"available",intelligence_reasons:"available",forecast_change:"available"}
  }});
  const html=renderToStaticMarkup(<PremiumMatchExperience prediction={dto} free={null}/>);
  for(const text of ["Arsenal Win","Arsenal</dt><dd>55.95%","Draw</dt><dd>33.13%","Leeds</dt><dd>10.92%","Recommendation: Cautious","Arsenal 2–0 Leeds","Exact Score Probability: 10.6%","Player Availability","Core-supplied player availability explanation.","+1.95 percentage points","Core-supplied forecast change explanation.","Bookmaker vs Compass"])expect(html).toContain(text);
 });
 it("renders every supplied Premium section or its explicit unavailable state",()=>{
  const dto=premiumCustomerSchema.parse(normalizePremiumAvailability(captured));
  const html=renderToStaticMarkup(<LiveMatches matchId={dto.match_id} identity={dto}><PremiumMatchExperience prediction={dto} free={null}/></LiveMatches>);
  for(const heading of ["Compass Pick","Recommendation Strength","Why Compass Thinks This","Bookmaker vs Compass","Ranked 1X2 Opportunities","Score Forecast","Forecast Change","Match lifecycle / history","Final historical review"])expect(html).toContain(heading);
  const intelligence=dto.premium_intelligence;
  for(const probability of Object.values(intelligence.primary_forecast.probabilities))expect(html).toContain(`${probability}%`);
  expect(html).toContain("Arsenal");expect(html).toContain("Leeds");
  expect(html).toContain(intelligence.compass_pick.selection);
  expect(html).toContain(intelligence.recommendation_strength.label);
  expect(html).toContain("Intelligence reasons are unavailable");
  expect(html).toContain("Score forecast is unavailable");expect(html).toContain("Forecast change is unavailable");
  expect(html).toContain("View Prediction Timeline");expect(html).toContain("Final historical review is unavailable");
  expect(html).toContain(`/my-predictions/${dto.match_id}/report`);
  expect(html).not.toContain("Add to Basket");expect(html).not.toContain("Continue to Payment");
  expect(html).not.toContain("Exact Score Probability: 10.6%");
 });
});
