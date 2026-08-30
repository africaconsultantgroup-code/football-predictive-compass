import { publicPredictionSchema, type PublicPrediction } from "./schema";
import {
  verifyPublicationSignature,
  type SignatureResult,
} from "./signature";
import type { WriteDecision } from "./freshness";

const MAX_BODY_BYTES = 64 * 1024;

type ReceiverDependencies = {
  secret: string;
  store: (prediction: PublicPrediction) => Promise<WriteDecision>;
  now?: () => number;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function signatureError(result: SignatureResult) {
  return result === "stale" ? "Request timestamp is invalid." : "Unauthorized.";
}

export function createPredictionReceiver({
  secret,
  store,
  now = Date.now,
}: ReceiverDependencies) {
  return async function receivePrediction(request: Request) {
    if (request.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed." });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: "Request body is too large." });
    }

    let rawBody: string;

    try {
      rawBody = await request.text();
    } catch {
      return jsonResponse(400, { error: "Invalid request body." });
    }

    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: "Request body is too large." });
    }

    const signatureResult = verifyPublicationSignature({
      timestamp: request.headers.get("x-predictive-compass-timestamp"),
      signature: request.headers.get("x-predictive-compass-signature"),
      rawBody,
      secret,
      now: now(),
    });

    if (signatureResult !== "valid") {
      return jsonResponse(401, { error: signatureError(signatureResult) });
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return jsonResponse(415, { error: "Content type must be application/json." });
    }

    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return jsonResponse(400, { error: "Invalid JSON." });
    }

    const validation = publicPredictionSchema.safeParse(parsedBody);

    if (!validation.success) {
      return jsonResponse(400, { error: "Invalid prediction payload." });
    }

    try {
      const result = await store(validation.data);

      if (result === "stale") {
        return jsonResponse(409, { error: "Stale prediction update." });
      }

      return jsonResponse(result === "create" ? 201 : 200, {
        ok: true,
        status: result,
      });
    } catch {
      return jsonResponse(500, { error: "Unable to store prediction." });
    }
  };
}
