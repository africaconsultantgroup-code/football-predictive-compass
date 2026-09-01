import { getLiveFootballMatches } from "@/lib/predictive-compass/server";
import { createLiveListHandler } from "@/lib/predictive-compass/live-routes";
import { capabilities, getCustomerAccess } from "@/lib/auth/access";
import { footballLiveMatchListSchema } from "@/lib/predictive-compass/schema";
import { toLiveListPreview } from "@/lib/predictive-compass/preview";
import { createCustomerAuthServerClient } from "@/lib/supabase/auth-server";
import { commercialStage, getPredictionOffers, hasPredictionAccess } from "@/lib/auth/match-access";

export const dynamic = "force-dynamic";
export const GET = createLiveListHandler(
  getLiveFootballMatches,
  getCustomerAccess,
  capabilities.liveFull,
  async (value, access) => {
    const list = footballLiveMatchListSchema.parse(value);
    const supabase = await createCustomerAuthServerClient();
    const matches = await Promise.all(list.matches.map(async (match) => {
      const stage = commercialStage(match.stage);
      const unlocked = stage
        ? await hasPredictionAccess({ access, supabase, matchId: match.match_id, stage })
        : false;
      const offers = stage ? await getPredictionOffers(supabase, match.match_id, stage) : [];
      return unlocked ? match : toLiveListPreview({ domain: "football", matches: [match] }, offers).matches[0];
    }));
    return { domain: "football" as const, matches };
  },
);
