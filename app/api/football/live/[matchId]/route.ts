import { getLiveFootballPrediction } from "@/lib/predictive-compass/server";
import { createLiveMatchHandler } from "@/lib/predictive-compass/live-routes";
import { capabilities, getCustomerAccess } from "@/lib/auth/access";
import { createCustomerAuthServerClient } from "@/lib/supabase/auth-server";
import { commercialStage, hasPredictionAccess } from "@/lib/auth/match-access";
import { footballMatchPredictionSchema } from "@/lib/predictive-compass/schema";

export const dynamic = "force-dynamic";

const handle = createLiveMatchHandler(
  getLiveFootballPrediction,
  getCustomerAccess,
  capabilities.liveFull,
  async (value, access) => {
    const match = footballMatchPredictionSchema.parse(value);
    const stage = commercialStage(match.stage);
    if (!stage) return null;
    return await hasPredictionAccess({ access, supabase: await createCustomerAuthServerClient(), matchId: match.match_id, stage }) ? match : null;
  },
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  return handle((await params).matchId);
}
