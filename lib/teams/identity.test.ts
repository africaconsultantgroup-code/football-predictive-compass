import { describe, expect, it, vi } from "vitest";
import { footballDataTeam, normalizeFixtureTeamMetadata, providerCrestUrl, resolveTeamIdentity, withTeamIdentities } from "./identity";
import { parseUpcomingFootballPredictions } from "../predictive-compass/schema";
import { freePrematchSchema } from "../predictive-compass/free";
import { toPredictionPreview } from "../predictive-compass/preview";
import snapshot from "../../data/team-identities.json";
import type { TeamIdentityRecord } from "./identity";
const cache=snapshot.teams as TeamIdentityRecord[];
const identity={match_id:`fm_${"a".repeat(32)}`,competition:"Premier League",home_team:"Arsenal",away_team:"Chelsea",kickoff_at:"2026-10-12T15:00:00Z",stage:"PREMATCH"};
const provider={id:57,name:"Arsenal FC",shortName:"Arsenal",tla:"ARS",crest:"https://crests.football-data.org/57.png",address:"not projected"};
const prediction={...identity,prediction_id:"stored",predicted_outcome:"home_win",predicted_score:null,probabilities:{home_win:50,draw:30,away_win:20},reliability:{score:70,label:"High"},verification_status:"verified",important_information_pending:false,customer_summary:"Forecast",customer_key_factors:[],generated_at:null,updated_at:null};
describe("canonical team identity",()=>{
  it("preserves football-data.org id/name/shortName/crest across normalization, DTO and locked preview",()=>{
    const [parsed]=parseUpcomingFootballPredictions({predictions:[{...prediction,homeTeam:provider}]});
    expect(parsed.home_team_identity).toMatchObject({footballDataId:57,shortName:"Arsenal",crestUrl:provider.crest});
    expect(parsed.home_team_identity).not.toHaveProperty("address");
    expect(toPredictionPreview(parsed).home_team_identity?.crestUrl).toBe(provider.crest);
    expect(toPredictionPreview(parsed)).not.toHaveProperty("probabilities");
  });
  it("preserves provider identity in the strict Free transport while still rejecting unrelated fields",()=>{
    const free={...identity,tier:"free",status:"available",probabilities:prediction.probabilities,predicted_outcome:"home_win",generated_at:"2026-10-10T12:00:00Z",homeTeam:provider};
    expect(freePrematchSchema.parse(withTeamIdentities(free)).home_team_identity?.crestUrl).toBe(provider.crest);
    expect(freePrematchSchema.safeParse(withTeamIdentities({...free,private_forecast:"never"})).success).toBe(false);
  });
  it("resolves supplied football-data crest before API-Football and cached URLs",()=>{
    const result=resolveTeamIdentity("Arsenal",{...footballDataTeam(provider),apiFootballId:42},cache);
    expect(result.crestUrl).toBe(provider.crest);expect(result.alternateCrests[0]).toBe("https://media.api-sports.io/football/teams/42.png");
  });
  it("uses an explicitly supplied canonical API-Football ID without a lookup or guessing",()=>{
    const result=resolveTeamIdentity("Arsenal",{apiFootballId:42});
    expect(result.crestSource).toBe("api-football");expect(result.crestUrl).toBe("https://media.api-sports.io/football/teams/42.png");
  });
  it("uses cached aliases and keeps IDs out of components",()=>{
    expect(resolveTeamIdentity("Man United",undefined,cache).apiFootballId).toBe(33);
    expect(resolveTeamIdentity("Nott'm Forest",undefined,cache).apiFootballId).toBe(65);
    expect(resolveTeamIdentity("Lens",undefined,cache).apiFootballId).toBe(116);
    expect(resolveTeamIdentity("Viking",undefined,cache).apiFootballId).toBe(759);
  });
  it("never guesses an ID for an unknown or ambiguous team",()=>{
    expect(resolveTeamIdentity("Sabah FA",undefined,cache)).toMatchObject({crestUrl:null,apiFootballId:null,fallbackInitials:"SF"});
    expect(withTeamIdentities({...identity,home_team_id:42})).not.toHaveProperty("home_team_identity");
  });
  it.each(["javascript:alert(1)","http://media.api-sports.io/football/teams/42.png","https://media.api-sports.io.evil.test/football/teams/42.png","https://user:pass@media.api-sports.io/football/teams/42.png","https://facebook.com/club.png","https://media.api-sports.io/football/teams/42.png?token=secret"])("rejects unsafe or arbitrary crest URL %s",url=>{
    expect(providerCrestUrl(url)).toBeNull();
  });
  it("accepts customer-safe flat crest metadata without interpreting ambiguous IDs",()=>{
    const normalized=withTeamIdentities({...identity,home_team_crest:provider.crest,home_team_id:999}) as {home_team_identity:TeamIdentityRecord};
    expect(normalized.home_team_identity).toMatchObject({crestUrl:provider.crest,footballDataId:null,apiFootballId:null});
  });
  it("normalizes nested freshness/history envelopes without changing forecast data",()=>{
    const normalized=normalizeFixtureTeamMetadata({prediction:{...prediction,homeTeam:provider}}) as {prediction:typeof prediction & {home_team_identity:TeamIdentityRecord}};
    expect(normalized.prediction.home_team_identity.crestUrl).toBe(provider.crest);expect(normalized.prediction.probabilities).toEqual(prediction.probabilities);
  });
  it("resolves an entire inventory without any provider/network calls",()=>{
    const fetch=vi.spyOn(globalThis,"fetch");
    for(let index=0;index<19;index++) resolveTeamIdentity("Arsenal",undefined,cache);
    expect(fetch).not.toHaveBeenCalled();fetch.mockRestore();
  });
});
