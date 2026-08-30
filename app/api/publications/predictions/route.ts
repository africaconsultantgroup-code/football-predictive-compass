import { createPredictionReceiver } from "@/lib/publications/receiver";
import { storePublicPrediction } from "@/lib/publications/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const publishingSecret = process.env.PREDICTIVE_COMPASS_PUBLISHING_SECRET;

  if (!publishingSecret) {
    return Response.json(
      { error: "Receiver is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return createPredictionReceiver({
    secret: publishingSecret,
    store: storePublicPrediction,
  })(request);
}
