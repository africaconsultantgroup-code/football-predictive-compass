"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { providerCrestUrl, resolveTeamIdentity, type TeamIdentityRecord } from "../lib/teams/identity";

const TeamCache = createContext<readonly TeamIdentityRecord[]>([]);
export function TeamIdentityProvider({ teams, children }: { teams: readonly TeamIdentityRecord[]; children: ReactNode }) {
  return <TeamCache.Provider value={teams}>{children}</TeamCache.Provider>;
}

export function TeamIdentity({ name, crest, team, inline = false }: { name: string; crest?: string | null; team?: TeamIdentityRecord | null; inline?: boolean }) {
  const cache = useContext(TeamCache);
  const identity = resolveTeamIdentity(name, team ?? (crest ? { crestUrl: providerCrestUrl(crest) } : undefined), cache);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const url = [identity.crestUrl, ...identity.alternateCrests].find(url => url && !failedUrls.includes(url));
  const Element = inline ? "span" : "div";
  return <Element className="matches-team"><span className={`matches-team-fallback${url ? " has-crest" : ""}`} aria-hidden="true">{url ?
    // Canonical supplied images only. Native img avoids granting a remote
    // optimization proxy access to unapproved hosts; no remotePatterns wildcard.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} width="32" height="32" alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrls(previous => [...previous, url])} /> : identity.fallbackInitials}</span><span>{name || "Team details pending"}</span></Element>;
}
