import { getLiveFootballPredictionHistory } from "@/lib/predictive-compass/server";
import { createLiveMatchHandler } from "@/lib/predictive-compass/live-routes";
import { capabilities, getCustomerAccess } from "@/lib/auth/access";
import { createCustomerAuthServerClient } from "@/lib/supabase/auth-server";
import { commercialStage, hasPredictionAccess } from "@/lib/auth/match-access";
import { footballPredictionHistorySchema } from "@/lib/predictive-compass/schema";
import { toLockedHistoryEntry } from "@/lib/predictive-compass/preview";

export const dynamic = "force-dynamic";

const handle = createLiveMatchHandler(
  getLiveFootballPredictionHistory,
  getCustomerAccess,
  capabilities.timelineFull,
  async (value, access) => {
    const timeline = footballPredictionHistorySchema.parse(value);
    const supabase = await createCustomerAuthServerClient();
    return {
      ...timeline,
      history: await Promise.all(timeline.history.map(async (entry) => {
        const stage = commercialStage(entry.stage);
        const unlocked = stage && await hasPredictionAccess({ access, supabase, matchId: timeline.match_id, stage });
        return unlocked || "locked" in entry ? entry : toLockedHistoryEntry(entry);
      })),
    };
  },
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  return handle((await params).matchId);
}
