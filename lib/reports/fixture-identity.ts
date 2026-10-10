import "server-only";
import { getStoredFreeUpcoming, getUpcomingFootballPredictions, getLiveFootballPredictionHistory } from "../predictive-compass/server";
import { canonicalCompetition } from "../predictive-compass/inventory";
import type { TeamIdentityRecord } from "../teams/identity";

// Read existing identities only. No freshness POST, provider fetch, forecast
// generation or publication/database writes are needed to label a purchase.
export async function loadFixtureIdentities() {
  const feeds = await Promise.allSettled([Promise.resolve().then(() => getStoredFreeUpcoming()), Promise.resolve().then(() => getUpcomingFootballPredictions({ syncProducts: false }))]);
  const identities = new Map<string, { homeTeam: string; awayTeam: string; competition: string; homeIdentity?: TeamIdentityRecord; awayIdentity?: TeamIdentityRecord }>();
  for (const feed of feeds) if (feed.status === "fulfilled") for (const item of feed.value) {
    if (item.match_id) identities.set(item.match_id, { homeTeam: item.home_team, awayTeam: item.away_team, competition: canonicalCompetition(item.competition), ...(item.home_team_identity ? {homeIdentity:item.home_team_identity} : {}), ...(item.away_team_identity ? {awayIdentity:item.away_team_identity} : {}) });
  }
  return identities;
}

export async function historicalFixtureIdentity(matchId: string) {
  try {
    const item = await getLiveFootballPredictionHistory(matchId);
    return { homeTeam: item.home_team, awayTeam: item.away_team, competition: canonicalCompetition(item.competition), ...(item.home_team_identity ? {homeIdentity:item.home_team_identity} : {}), ...(item.away_team_identity ? {awayIdentity:item.away_team_identity} : {}) };
  } catch { return { homeTeam: "", awayTeam: "", competition: "" }; }
}
