import { getLiveFootballPredictionHistory } from "@/lib/predictive-compass/server";
import { createLiveMatchHandler } from "@/lib/predictive-compass/live-routes";
import { capabilities, getCustomerAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

const handle = createLiveMatchHandler(
  getLiveFootballPredictionHistory,
  getCustomerAccess,
  capabilities.timelineFull,
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  return handle((await params).matchId);
}
