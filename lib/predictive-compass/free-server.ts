import "server-only";
import { unavailableFreePrematch } from "./free";
import { getUpcomingFootballPredictions, getStoredFreePrematch, getStoredFreeUpcoming } from "./server";
import type { FreeMatchIdentity } from "./free";
import { canonicalCompetition, inventoryFailure, reportInventory } from "./inventory";

// Dedicated free source only. Premium is used solely for unavailable identity.
export async function getFreePrematchPrediction(matchId: string, identity?: FreeMatchIdentity) {
  try {
    const stored = await getStoredFreePrematch(matchId);
    if (stored && (!identity || sameFreeFixture(stored, identity))) return stored;
  } catch { /* Missing source/outage remains unavailable, never premium. */ }
  if (identity) return unavailableFreePrematch(identity);
  const match = (await getUpcomingFootballPredictions({ syncProducts: false }))
    .find(item => item.match_id === matchId && item.stage === "PREMATCH");
  return match?.match_id ? unavailableFreePrematch({ ...match, match_id: match.match_id }) : null;
}

export function sameFreeFixture(free: FreeMatchIdentity, fixture: FreeMatchIdentity) {
  return free.match_id === fixture.match_id && canonicalCompetition(free.competition) === canonicalCompetition(fixture.competition) &&
    free.home_team === fixture.home_team && free.away_team === fixture.away_team &&
    (free.kickoff_at === fixture.kickoff_at || (free.kickoff_at !== null && fixture.kickoff_at !== null &&
      new Date(free.kickoff_at).getTime() === new Date(fixture.kickoff_at).getTime()));
}

export async function getFreeUpcomingPredictions() {
  return (await loadFreeUpcoming()).predictions;
}

export async function loadFreeUpcoming() {
  try {
    const predictions = (await getStoredFreeUpcoming()).map(item => ({ ...item, competition: canonicalCompetition(item.competition) }));
    const diagnostic = predictions.length ? "INVENTORY_AVAILABLE" : "CORE_EMPTY";
    reportInventory("free", diagnostic, predictions.length);
    return { predictions, failed: false, diagnostic } as const;
  } catch (error) {
    const diagnostic = inventoryFailure(error);
    reportInventory("free", diagnostic);
    return { predictions: [], failed: true, diagnostic } as const;
  }
}
