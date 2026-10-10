import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

// Read-only audit. No credentials, provider searches, payments or registry writes.
const registry = JSON.parse(readFileSync(new URL("../data/team-identities.json", import.meta.url), "utf8")).teams;
const key = name => name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const lookup = name => registry.find(team => [team.canonicalName, ...team.aliases].some(alias => key(alias) === key(name)));
for (const team of registry) {
  if (!team.crestUrl) continue;
  assert.equal(team.crestUrl, `https://media.api-sports.io/football/teams/${team.apiFootballId}.png`);
  assert(team.verification?.source === team.crestUrl && team.verifiedAt, "Missing source verification");
}
if (process.argv.includes("--verify-media")) {
  for (const team of registry.filter(team => team.crestUrl)) {
    const response = await fetch(team.crestUrl, { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, `${team.canonicalName}: crest unavailable`);
    assert(response.headers.get("content-type")?.startsWith("image/"));
    await response.arrayBuffer();
  }
  console.log(JSON.stringify({ verifiedProviderImages: registry.filter(team => team.crestUrl).length }));
}
const inventoryPath = process.argv.find(arg => arg.endsWith(".json"));
if (inventoryPath) {
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  const fixtures = inventory.feeds.free.body.predictions;
  const names = [...new Set(fixtures.flatMap(match => [match.home_team, match.away_team]))];
  const teams = [...new Map(names.map(name => { const team = lookup(name); return [team?.canonicalName ?? name, team]; })).values()];
  console.log(JSON.stringify({ capturedAt: inventory.at, fixtures: fixtures.length,
    bothCrests: fixtures.filter(match => lookup(match.home_team)?.crestUrl && lookup(match.away_team)?.crestUrl).length,
    uniqueTeams: teams.length, footballDataTeams: teams.filter(team => team?.crestSource === "football-data.org").length,
    apiFootballTeams: teams.filter(team => team?.crestSource === "api-football").length,
    initialsTeams: teams.filter(team => !team?.crestUrl).length,
    unresolved: names.filter(name => !lookup(name)?.crestUrl) }));
}
