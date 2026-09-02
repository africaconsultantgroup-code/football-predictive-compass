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
      message = result.status === "successful" ? "Payment verified. Your prediction access is unlocked." : result.status === "grant_failed" ? "Payment received after access closed. Support review is required." : "Payment is not yet complete.";
    } catch (error) {
      if (error instanceof PaystackConfigurationError) message = "Payment verification is not configured yet.";
    }
  }
  return <main className="min-h-screen bg-slate-950 px-6 py-20 text-white"><section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-8"><h1 className="text-3xl font-semibold">Payment Status</h1><p className="mt-5 text-slate-300">{message}</p><a className="mt-8 inline-block text-emerald-300" href="/account">Return to account</a></section></main>;
}
