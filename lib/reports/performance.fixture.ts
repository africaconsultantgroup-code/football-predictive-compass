// Test-only contract example derived from Core's test_official_premium_snapshot.py.
// Never used as a production source or claimed to be a real settled record.
import {premiumIntelligenceFixture} from "../predictive-compass/premium.fixture";
import type {OfficialPerformance} from "./performance-contract";
export const officialPerformanceFixture:OfficialPerformance["records"][number]={
 competition:"Premier League",competition_code:"premier-league",home_team:"Arsenal",away_team:"Leeds",kickoff_at:"2026-10-10T11:30:00+00:00",
 compass_pick:{market:"Match Result",selection:"Arsenal to win",model_probability:55.95,strength:"Cautious",generated_at:"2026-10-10T11:20:00+00:00"},
 probabilities:{home_win:55.95,draw:33.13,away_win:10.92},recommendation_strength:{label:"Cautious",score:93.6},
 score_forecast:{status:"available",most_likely_score:{home:2,away:0},score_probability:10.6,alternative_scorelines:[]},exact_score_probability:10.6,
 bookmaker_comparison:[],intelligence_reasons:premiumIntelligenceFixture.intelligence_reasons,
 generated_at:"2026-10-10T11:20:00+00:00",evidence_cutoff_at:"2026-10-10T11:20:00+00:00",premium_readiness_status:"READY",released_at:"2026-10-10T11:20:00+00:00",status:"FROZEN_PREMATCH",
 settlement:{actual_home_score:2,actual_away_score:1,actual_outcome:"home_win",compass_pick_correct:true,predicted_score:{home:2,away:0},actual_score:{home:2,away:1},exact_score_correct:false,settled_at:"2026-10-10T13:30:00+00:00",regulation_time:true},
};
