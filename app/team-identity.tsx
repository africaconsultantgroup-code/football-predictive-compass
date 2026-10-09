"use client";
import { useState } from "react";
import { safeCrestUrl } from "../lib/predictive-compass/fixture";

export function TeamIdentity({ name, crest }: { name: string; crest?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = safeCrestUrl(crest ?? undefined);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? "").join("").toUpperCase() || "?";
  return <div className="matches-team"><span className="matches-team-fallback" aria-hidden="true">{url && failedUrl !== url ?
    // Canonical supplied images only. Native img avoids granting a remote
    // optimization proxy access to unapproved hosts; no remotePatterns wildcard.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} width="32" height="32" alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} /> : initials}</span><span>{name || "Team details pending"}</span></div>;
}
