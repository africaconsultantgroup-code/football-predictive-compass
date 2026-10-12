import type { historicalClassification } from "../lib/reports/historical";

export function HistoricalPremiumBadge({classification}:{classification:ReturnType<typeof historicalClassification>|null}) {
  if (!classification) return null;
  return <span className="historical-premium-badge" data-testid="historical-premium-status">{classification}{classification === "OFFICIAL PREMIUM" ? " ✓" : ""}</span>;
}
