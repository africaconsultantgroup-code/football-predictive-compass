import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export class PaystackConfigurationError extends Error {}

export function getPaystackSecretKey(environment: Record<string, string | undefined> = process.env) {
  const key = environment.PAYSTACK_SECRET_KEY;
  if (!key || !key.startsWith("sk_test_")) {
    throw new PaystackConfigurationError("Paystack test configuration is unavailable.");
  }
  return key;
}

export function amountToSubunits(amount: string | number) {
  const value = String(amount);
  const match = value.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Invalid payment amount.");
  return `${match[1]}${(match[2] ?? "").padEnd(2, "0")}`.replace(/^0+(?=\d)/, "");
}

export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}

export async function processPaystackWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
  fulfill: (reference: string) => Promise<unknown>,
) {
  if (!verifyPaystackSignature(rawBody, signature, secret)) return { accepted: false as const };
  const event = JSON.parse(rawBody);
  if (event.event === "charge.success" && typeof event.data?.reference === "string") {
    await fulfill(event.data.reference);
  }
  return { accepted: true as const };
}

export function createPaystackClient({
  secretKey = getPaystackSecretKey(),
  fetch: request = fetch,
}: { secretKey?: string; fetch?: typeof fetch } = {}) {
  async function paystackRequest(path: string, init?: RequestInit) {
    const response = await request(`https://api.paystack.co${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });
    const value = await response.json();
    if (!response.ok || !value?.status) throw new Error("Paystack request failed.");
    return value.data;
  }
  return {
    initialize(input: { email: string; amount: string; currency: string; reference: string; callbackUrl: string; metadata: object }) {
      return paystackRequest("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({ ...input, callback_url: input.callbackUrl, channels: ["card", "mobile_money"] }),
      });
    },
    verify(reference: string) {
      return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    },
  };
}
