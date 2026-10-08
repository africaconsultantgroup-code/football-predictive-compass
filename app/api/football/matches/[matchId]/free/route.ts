import { createFreePrematchHandler } from "@/lib/predictive-compass/free";
import { getFreePrematchPrediction } from "@/lib/predictive-compass/free-server";

const handle = createFreePrematchHandler(getFreePrematchPrediction);
export async function GET(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  return handle((await context.params).matchId);
}
