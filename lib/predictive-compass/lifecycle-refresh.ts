// Timing controls request frequency only. It never grants readiness or access.
export function lifecycleRefreshDelay(kickoff: string | null, ready: boolean, now = Date.now()) {
  const remaining = kickoff ? Date.parse(kickoff) - now : Infinity;
  if (remaining <= 0) return 60_000;
  if (ready) return Math.min(300_000, Math.max(30_000, remaining));
  return remaining > 3_600_000 ? 300_000 : remaining > 900_000 ? 120_000 : 30_000;
}
