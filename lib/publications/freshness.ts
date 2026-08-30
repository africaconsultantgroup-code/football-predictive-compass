import type { PublicPrediction } from "./schema";

export type ExistingPublication = Pick<
  PublicPrediction,
  "publication_version" | "source_updated_at"
>;

export type WriteDecision = "create" | "duplicate" | "stale" | "update";

export function decidePredictionWrite(
  existing: ExistingPublication | null,
  incoming: PublicPrediction,
): WriteDecision {
  if (!existing) {
    return "create";
  }

  const incomingTime = Date.parse(incoming.source_updated_at);
  const existingTime = Date.parse(existing.source_updated_at);

  if (
    incoming.publication_version === existing.publication_version &&
    incomingTime === existingTime
  ) {
    return "duplicate";
  }

  if (
    incoming.publication_version <= existing.publication_version ||
    incomingTime <= existingTime
  ) {
    return "stale";
  }

  return "update";
}
