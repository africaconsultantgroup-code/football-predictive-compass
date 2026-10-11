import { z } from "zod";

export const premiumReadinessSchema = z.object({
  status: z.enum(["PREPARING", "READY", "LOCKED_PRE_KICKOFF", "LIVE", "HISTORICAL"]),
  customer_visible: z.boolean(),
  reason: z.string(),
  release_at: z.string().datetime({ offset: true }).nullable(),
  last_late_refresh_at: z.string().datetime({ offset: true }).nullable(),
  missing_requirements: z.array(z.string()),
}).strict();

export type PremiumReadiness = z.infer<typeof premiumReadinessSchema>;

export const PREMIUM_PREPARING_MESSAGE = "Final match intelligence is being prepared using late team news, lineup, market and match information.";

// Payment, role, timestamps and the presence of a stored forecast cannot grant readiness.
export function premiumIntelligenceReady(value: { premium_intelligence?: { readiness?: PremiumReadiness | null } } | null | undefined) {
  return value?.premium_intelligence?.readiness?.customer_visible === true;
}
