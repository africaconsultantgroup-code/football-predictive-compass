import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;
const SIGNATURE_PATTERN = /^(?:sha256=)?([a-fA-F0-9]{64})$/;

export type SignatureResult = "valid" | "invalid" | "stale";

type VerifySignatureOptions = {
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  secret: string;
  now?: number;
};

export function createPublicationSignature(
  timestamp: string,
  rawBody: string,
  secret: string,
) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
}

export function verifyPublicationSignature({
  timestamp,
  signature,
  rawBody,
  secret,
  now = Date.now(),
}: VerifySignatureOptions): SignatureResult {
  if (!timestamp || !signature || !secret || !/^\d{10}$/.test(timestamp)) {
    return "invalid";
  }

  const timestampMs = Number(timestamp) * 1000;

  if (!Number.isSafeInteger(timestampMs)) {
    return "invalid";
  }

  if (Math.abs(now - timestampMs) > MAX_TIMESTAMP_SKEW_MS) {
    return "stale";
  }

  const match = signature.match(SIGNATURE_PATTERN);

  if (!match) {
    return "invalid";
  }

  const expected = Buffer.from(
    createPublicationSignature(timestamp, rawBody, secret),
    "hex",
  );
  const provided = Buffer.from(match[1], "hex");

  return timingSafeEqual(expected, provided) ? "valid" : "invalid";
}
