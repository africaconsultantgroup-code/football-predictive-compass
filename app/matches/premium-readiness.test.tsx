import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { PremiumMatchExperience } from "./premium-components";
import { PredictionCard } from "../predictions";
import { premiumIntelligenceSchema } from "../../lib/predictive-compass/premium-contract";
import { premiumIntelligenceFixture } from "../../lib/predictive-compass/premium.fixture";
import { createPremiumMatchHandler, premiumCustomerSchema } from "../../lib/predictive-compass/premium";
import { premiumIntelligenceReady, PREMIUM_PREPARING_MESSAGE } from "../../lib/predictive-compass/premium-readiness";
import { footballPredictionSchema } from "../../lib/predictive-compass/schema";

const identity={match_id:`fm_${"a".repeat(32)}`,competition:"Premier League",home_team:"Home",away_team:"Away",kickoff_at:"2026-10-10T14:00:00Z",stage:"PREMATCH",tier:"premium",status:"available"};
const readiness={status:"PREPARING" as const,customer_visible:false,reason:"PREMIUM_REQUIREMENTS_INCOMPLETE",release_at:"2026-10-10T13:30:00Z",last_late_refresh_at:null,missing_requirements:["late_information_refresh"]};
const preparing={...premiumIntelligenceFixture,readiness,primary_forecast:null,compass_pick:null,market_opportunities:[],bookmaker_comparison:[],intelligence_reasons:[],forecast_change:{available:false,free_leading_outcome:null,free_probability:null,premium_leading_outcome:null,premium_probability:null,probability_point_change:null,leading_outcome_changed:null,reasons:[]},recommendation_strength:{label:"Unavailable",score:null},score_forecast:{status:"unavailable",most_likely_score:null,score_probability:null,alternative_scorelines:[]},generated_at:null,availability:{compass_pick:"preparing",market_opportunities:"preparing",bookmaker_comparison:"preparing",intelligence_reasons:"preparing",forecast_change:"preparing",score_forecast:"preparing"}};

describe("Core-authoritative Premium readiness",()=>{
 it("parses the exact Core PREPARING serialization including nulls and preparing sections",()=>{
  expect(premiumIntelligenceSchema.parse(preparing)).toEqual(preparing);
  expect(premiumCustomerSchema.parse({...identity,premium_intelligence:preparing}).premium_intelligence.readiness).toEqual(readiness);
 });
 it.each([undefined,...["PREPARING","READY","LOCKED_PRE_KICKOFF","LIVE","HISTORICAL"].map(status=>({...readiness,status}))])("never leaks an old populated snapshot when visibility is false or missing: %j",async value=>{
  const dto=premiumCustomerSchema.parse({...identity,premium_intelligence:{...premiumIntelligenceFixture,readiness:value}});
  expect(premiumIntelligenceReady(dto)).toBe(false);
  const html=renderToStaticMarkup(<PremiumMatchExperience prediction={dto} free={null}/>);
  expect(html).toContain("Premium Intelligence Unlocked");expect(html).toContain(PREMIUM_PREPARING_MESSAGE);
  for(const hidden of ["58%","65/100","Compass Pick","Home FC to win","14%","Bookmaker vs Compass"])expect(html).not.toContain(hidden);
  const response=await createPremiumMatchHandler(async()=>"entitled",async()=>dto)(identity.match_id);
  expect(response.status).toBe(503);expect(await response.text()).not.toContain("premium_intelligence");
 });
 it("renders a complete DTO only when customer_visible is true",()=>{
  const dto=premiumCustomerSchema.parse({...identity,premium_intelligence:premiumIntelligenceFixture});
  const html=renderToStaticMarkup(<PremiumMatchExperience prediction={dto} free={null}/>);
  expect(html).toContain("Compass Pick");expect(html).toContain("58%");expect(html).toContain("Exact Score Probability: 14%");
 });
 it.each(["status","customer_visible","reason","release_at","last_late_refresh_at","missing_requirements"])("rejects an incomplete readiness object without %s",key=>{
  const incomplete={...readiness} as Record<string,unknown>;delete incomplete[key];
  expect(premiumIntelligenceSchema.safeParse({...preparing,readiness:incomplete}).success).toBe(false);
 });
 it("rejects unknown readiness fields and invalid timestamps",()=>{
  expect(premiumIntelligenceSchema.safeParse({...preparing,readiness:{...readiness,engine_secret:"private"}}).success).toBe(false);
  expect(premiumIntelligenceSchema.safeParse({...preparing,readiness:{...readiness,release_at:"tomorrow"}}).success).toBe(false);
 });
 it("preserves the current readiness marker through the legacy fixture adapter and hides owned summary content",()=>{
  const prediction=footballPredictionSchema.parse({...identity,prediction_id:"stored",predicted_outcome:"home_win",predicted_score:null,probabilities:{home_win:58,draw:25,away_win:17},reliability:{label:"High",score:90},verification_status:"updated",important_information_pending:false,customer_summary:"private old summary",customer_key_factors:[],generated_at:null,updated_at:null,premium_intelligence:preparing});
  expect(prediction.premium_intelligence?.readiness).toEqual(readiness);
  const html=renderToStaticMarkup(<PredictionCard prediction={prediction}/>);
  expect(html).toContain(PREMIUM_PREPARING_MESSAGE);expect(html).not.toContain("58%");expect(html).not.toContain("private old summary");
 });
});
