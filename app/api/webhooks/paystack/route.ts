import { createPaystackClient, getPaystackSecretKey, PaystackConfigurationError, processPaystackWebhook } from "@/lib/payments/paystack";
import { verifyAndFulfillPayment } from "@/lib/payments/service";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const secret = getPaystackSecretKey();
    const processed = await processPaystackWebhook(rawBody, request.headers.get("x-paystack-signature"), secret, async (reference) => {
      const result = await verifyAndFulfillPayment({ admin: getServerSupabaseClient(), paystack: createPaystackClient({ secretKey: secret }), reference });
      if (result.status === "verification_failed") throw new Error("Verification unavailable.");
    });
    if (!processed.accepted) {
      return Response.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
    }
    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof PaystackConfigurationError) return Response.json({ error: "PAYSTACK_CONFIGURATION_REQUIRED" }, { status: 503 });
    return Response.json({ error: "WEBHOOK_PROCESSING_FAILED" }, { status: 400 });
  }
}
