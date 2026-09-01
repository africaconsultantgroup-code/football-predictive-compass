import { getLiveFootballPrediction } from "@/lib/predictive-compass/server";
import { createLiveMatchHandler } from "@/lib/predictive-compass/live-routes";
import { capabilities, getCustomerAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

const handle = createLiveMatchHandler(
  getLiveFootballPrediction,
  getCustomerAccess,
  capabilities.liveFull,
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  return handle((await params).matchId);
}
