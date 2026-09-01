import { getLiveFootballMatches } from "@/lib/predictive-compass/server";
import { createLiveListHandler } from "@/lib/predictive-compass/live-routes";
import { capabilities, getCustomerAccess } from "@/lib/auth/access";
import { footballLiveMatchListSchema } from "@/lib/predictive-compass/schema";
import { toLiveListPreview } from "@/lib/predictive-compass/preview";

export const dynamic = "force-dynamic";
export const GET = createLiveListHandler(
  getLiveFootballMatches,
  getCustomerAccess,
  capabilities.liveFull,
  (value) => toLiveListPreview(footballLiveMatchListSchema.parse(value)),
);
