import { CustomerShell } from "../../../customer-shell";
import { createPaystackClient, PaystackConfigurationError } from "@/lib/payments/paystack";
import { verifyAndFulfillPayment } from "@/lib/payments/service";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PaystackCallback({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const reference = (await searchParams).reference;
  let message = "We could not verify this payment.";
  if (reference && /^[A-Za-z0-9.=-]+$/.test(reference)) {
    try {
      const result = await verifyAndFulfillPayment({ admin: getServerSupabaseClient(), paystack: createPaystackClient(), reference });
      message = result.status === "successful" ? "Payment verified. Your prediction access is unlocked." : result.status === "grant_failed" ? "Payment requires support review. No new payment is needed while this is reviewed." : "Payment is not yet complete.";
    } catch (error) {
      if (error instanceof PaystackConfigurationError) message = "Payment verification is not configured yet.";
    }
  }
  return <CustomerShell authenticated={false}><section className="auth-card"><h1 className="text-3xl font-semibold">Payment Status</h1><p className="mt-5 text-slate-600">{message}</p><a className="mt-8 inline-block text-blue-700" href="/account">Return to account</a></section></CustomerShell>;
}
