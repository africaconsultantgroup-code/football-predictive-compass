import { createPremiumMatchHandler } from "@/lib/predictive-compass/premium";
import { authorizePremiumMatch, loadPremiumMatch } from "@/lib/predictive-compass/premium-server";

const handle = createPremiumMatchHandler(authorizePremiumMatch, loadPremiumMatch);
export async function GET(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  return handle((await context.params).matchId);
}
