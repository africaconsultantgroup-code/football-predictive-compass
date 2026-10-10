export type TeamIdentityRecord = {
  canonicalName: string; shortName: string | null; footballDataId: number | null;
  apiFootballId: number | null; crestUrl: string | null; fallbackInitials: string;
  aliases: string[]; crestSource: "football-data.org" | "api-football" | "cache" | null;
  alternateCrests: string[];
};
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const id = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
export const teamKey = (name: string) => name.normalize("NFKC").trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
export function providerCrestUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
    return (url.hostname === "crests.football-data.org" && /^\/[a-zA-Z0-9_-]+\.(png|svg|webp)$/.test(url.pathname)) || (url.hostname === "media.api-sports.io" && /^\/football\/teams\/[1-9]\d*\.png$/.test(url.pathname)) ? url.href : null;
  } catch { return null; }
}
export function fallbackInitials(name: string) { return name.trim().split(/\s+/).slice(0,2).map(part=>part[0]??"").join("").toUpperCase() || "?"; }
export function resolveTeamIdentity(name: string, supplied?: unknown, cache: readonly TeamIdentityRecord[] = []): TeamIdentityRecord {
  const value = object(supplied);
  const footballDataId = id(value.footballDataId);
  const apiFootballId = id(value.apiFootballId);
  // Names are lookup aliases from verified provider records, never numeric-ID guesses.
  const cached = cache.find(item => footballDataId && item.footballDataId === footballDataId || apiFootballId && item.apiFootballId === apiFootballId)
    ?? cache.find(item => [item.canonicalName, ...item.aliases].some(alias=>teamKey(alias)===teamKey(name)));
  const fd = providerCrestUrl(value.footballDataCrest) ?? (providerCrestUrl(value.crestUrl)?.includes("crests.football-data.org/") ? providerCrestUrl(value.crestUrl) : null);
  const apiId = apiFootballId ?? cached?.apiFootballId ?? null;
  const api = apiId ? `https://media.api-sports.io/football/teams/${apiId}.png` : null;
  const cachedUrl = providerCrestUrl(cached?.crestUrl);
  const suppliedUrl = providerCrestUrl(value.crestUrl);
  const urls = [...new Set([fd, api, cachedUrl, suppliedUrl, ...(cached?.alternateCrests ?? [])].map(providerCrestUrl).filter((url): url is string => Boolean(url)))];
  return { canonicalName: text(value.canonicalName) ?? cached?.canonicalName ?? name, shortName: text(value.shortName) ?? cached?.shortName ?? null,
    footballDataId: footballDataId ?? cached?.footballDataId ?? null, apiFootballId: apiId,
    crestUrl: urls[0] ?? null, fallbackInitials: fallbackInitials(name), aliases: [...new Set([...(cached?.aliases ?? []), ...(Array.isArray(value.aliases) ? value.aliases.filter((alias):alias is string=>typeof alias==="string"&&alias.length<120) : [])])],
    crestSource: fd ? "football-data.org" : api ? "api-football" : cachedUrl ? "cache" : suppliedUrl?.includes("crests.football-data.org") ? "football-data.org" : suppliedUrl ? "api-football" : null,
    alternateCrests: urls.slice(1) };
}
export function footballDataTeam(value: unknown): TeamIdentityRecord | undefined {
  const team=object(value), name=text(team.name);
  if(!name || !id(team.id)) return undefined;
  const result=resolveTeamIdentity(name,{ canonicalName:name,shortName:team.shortName,footballDataId:team.id,footballDataCrest:team.crest });
  return { ...result, aliases:[name,...[text(team.shortName),text(team.tla)].filter((s):s is string=>Boolean(s))] };
}
export function apiFootballTeam(value: unknown): TeamIdentityRecord | undefined {
  const team=object(value), name=text(team.name);
  if(!name || !id(team.id)) return undefined;
  return { ...resolveTeamIdentity(name,{canonicalName:name,apiFootballId:team.id}), aliases:[name] };
}
// Explicit display-only projection, independent of prediction/paid intelligence.
export function withTeamIdentities(value: unknown): unknown {
  if(!value || typeof value!=="object" || Array.isArray(value)) return value;
  const { homeTeam, awayTeam, teams, home_team_crest, away_team_crest, home_team_id: _homeId, away_team_id: _awayId, home_team_api_football_id, away_team_api_football_id, home_team_football_data_id, away_team_football_data_id, ...rest } = value as ObjectValue;
  // Unqualified IDs have no provider namespace: never guess which ID system.
  void _homeId; void _awayId;
  const api=object(teams);
  function flat(name: unknown, crest: unknown, fdId: unknown, apiId: unknown) {
    if(typeof name!=="string" || !(providerCrestUrl(crest)||id(fdId)||id(apiId))) return undefined;
    return resolveTeamIdentity(name,{canonicalName:name,crestUrl:crest,footballDataId:fdId,apiFootballId:apiId});
  }
  const home=footballDataTeam(homeTeam) ?? apiFootballTeam(api.home) ?? flat(rest.home_team,home_team_crest,home_team_football_data_id,home_team_api_football_id);
  const away=footballDataTeam(awayTeam) ?? apiFootballTeam(api.away) ?? flat(rest.away_team,away_team_crest,away_team_football_data_id,away_team_api_football_id);
  return { ...rest, ...(home ? {home_team_identity:home} : {}), ...(away ? {away_team_identity:away} : {}) };
}
export function normalizeFixtureTeamMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeFixtureTeamMetadata);
  const result=withTeamIdentities(value);
  if (!result || typeof result!=="object" || Array.isArray(result)) return result;
  const copy={...result} as ObjectValue;
  for(const key of ["prediction","predictions","data","matches","history"]) if(copy[key] && typeof copy[key]==="object") copy[key]=normalizeFixtureTeamMetadata(copy[key]);
  return copy;
}
