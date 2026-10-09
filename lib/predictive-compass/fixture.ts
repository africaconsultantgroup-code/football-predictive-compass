import { canonicalCompetition } from "./inventory";

type Identity = { match_id: string | null; home_team: string; away_team: string; competition: string; kickoff_at: string | null; stage: string };
// Display metadata is independent of paid forecast contents. A provider can
// supply these explicit metadata values; never infer a crest URL from a name.
export type TeamDisplayMetadata = { shortName?: string; crest?: string };
export function safeCrestUrl(value?: string): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function customerFixture(identity: Identity, state: { freeAvailable: boolean; premiumAvailable: boolean; owned: boolean }, metadata?: { home?: TeamDisplayMetadata; away?: TeamDisplayMetadata }) {
  const competition = canonicalCompetition(identity.competition);
  return {
    matchId: identity.match_id,
    homeTeamName: identity.home_team,
    awayTeamName: identity.away_team,
    homeTeamShortName: metadata?.home?.shortName ?? null,
    awayTeamShortName: metadata?.away?.shortName ?? null,
    homeTeamLogo: safeCrestUrl(metadata?.home?.crest),
    awayTeamLogo: safeCrestUrl(metadata?.away?.crest),
    competitionName: competition,
    competitionCode: competition === "Premier League" ? "EPL" : competition === "UEFA Champions League" ? "UCL" : null,
    kickoff: identity.kickoff_at,
    status: identity.stage,
    freeAvailable: state.freeAvailable,
    premiumAvailable: state.premiumAvailable,
    owned: state.owned,
    basketEligible: Boolean(identity.match_id && identity.kickoff_at && identity.stage === "PREMATCH" && Date.parse(identity.kickoff_at) > Date.now() && state.premiumAvailable && !state.owned),
  };
}

export function fixtureTitle(home?: string, away?: string) {
  return home && away ? `${home} vs ${away}` : "Match details being prepared";
}
