import { z } from "zod";
import { resolveTeamIdentity } from "./identity";
const team = z.unknown().transform(value => {
  if (!value || typeof value !== "object" || !("canonicalName" in value) || typeof value.canonicalName !== "string") return undefined;
  return resolveTeamIdentity(value.canonicalName, value);
}).optional();
export const teamIdentityFields = { home_team_identity: team, away_team_identity: team };
