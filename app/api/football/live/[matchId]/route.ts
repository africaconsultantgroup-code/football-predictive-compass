import { getLiveFootballPrediction } from "@/lib/predictive-compass/server";
import { createLiveMatchHandler } from "@/lib/predictive-compass/live-routes";

export const dynamic = "force-dynamic";

const handle = createLiveMatchHandler(getLiveFootballPrediction);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  return handle((await params).matchId);
}
