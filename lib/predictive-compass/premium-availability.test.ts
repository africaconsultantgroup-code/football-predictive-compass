import {describe,it,expect} from "vitest";
import {normalizePremiumAvailability,premiumCustomerSchema} from "./premium";
import {premiumIntelligenceFixture} from "./premium.fixture";

describe("Core unavailable-score compatibility",()=>{
  const fixture={match_id:`fm_${"a".repeat(32)}`,competition:"Premier League",home_team:"Home",away_team:"Away",kickoff_at:"2026-10-10T14:00:00Z",stage:"PREMATCH",tier:"premium",status:"available",premium_intelligence:premiumIntelligenceFixture};
  it("retains valid intelligence when an unavailable score carries a residual probability",()=>{
    const intelligence={...premiumIntelligenceFixture,availability:{...premiumIntelligenceFixture.availability,score_forecast:"unavailable"},score_forecast:{status:"unavailable",most_likely_score:null,score_probability:10.6,alternative_scorelines:[]}};
    const source={...fixture,premium_intelligence:intelligence};
    const parsed=premiumCustomerSchema.parse(normalizePremiumAvailability(source));
    expect(parsed.premium_intelligence.score_forecast.score_probability).toBeNull();
    expect(parsed.premium_intelligence.compass_pick).toEqual(intelligence.compass_pick);
    expect(parsed.premium_intelligence.primary_forecast).toEqual(intelligence.primary_forecast);
    expect(parsed.premium_intelligence.intelligence_reasons).toEqual(intelligence.intelligence_reasons);
    expect(source.premium_intelligence.score_forecast.score_probability).toBe(10.6);
  });
  it("preserves an available score and its probability exactly",()=>{
    expect(premiumCustomerSchema.parse(normalizePremiumAvailability(fixture))).toEqual(fixture);
  });
  it("continues rejecting a contradictory available score",()=>{
    const source={...fixture,premium_intelligence:{...premiumIntelligenceFixture,score_forecast:{...premiumIntelligenceFixture.score_forecast,most_likely_score:null}}};
    expect(()=>premiumCustomerSchema.parse(normalizePremiumAvailability(source))).toThrow();
  });
});
