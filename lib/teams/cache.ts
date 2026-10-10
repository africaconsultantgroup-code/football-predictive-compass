import "server-only";
import snapshot from "../../data/team-identities.json";
import { resolveTeamIdentity, type TeamIdentityRecord } from "./identity";

// Durable, reviewed registry snapshot; changes are verified before release.
// No network, database or provider call in the fixture-rendering path.
const cached = snapshot.teams as TeamIdentityRecord[];
export function cachedTeamIdentities(): readonly TeamIdentityRecord[] { return cached; }
export function canonicalTeamIdentity(name: string, supplied?: unknown) { return resolveTeamIdentity(name, supplied, cached); }
