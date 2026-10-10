import { getCurrentUser } from "@/lib/auth/session";
import { getCustomerAccess } from "@/lib/auth/access";
import { calculateMatchBasketPrice, verifyBasketPayment } from "@/lib/payments/basket-service";
import { createPaystackClient } from "@/lib/payments/paystack";
import { BasketError, matchSelectionSchema } from "@/lib/payments/match-pricing";
import { matchPricingV2Enabled } from "@/lib/payments/pricing-version";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { loadPendingMatchCheckouts } from "@/lib/payments/pending-checkout";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.email) return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!matchPricingV2Enabled()) return Response.json({ error: "MATCH_PRICING_NOT_ENABLED" }, { status: 503 });
  const parsed = matchSelectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "INVALID_SELECTION" }, { status: 400 });
  try {
    if ((await getCustomerAccess())?.owner) return Response.json({ error: "PREMIUM_ALREADY_UNLOCKED" }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
    const admin = getServerSupabaseClient();
    const pending = (await loadPendingMatchCheckouts(admin, user.id, { matchIds: parsed.data.match_ids, reconcile: reference => verifyBasketPayment({ admin, paystack: createPaystackClient(), reference }) })).find(item => item.matchIds.some(id => parsed.data.match_ids.includes(id)));
    if (pending) return Response.json({ pending_checkout: pending }, { headers: { "Cache-Control": "private, no-store" } });
    const { user_id: _owner, ...quote } = await calculateMatchBasketPrice({ admin, matchIds: parsed.data.match_ids, userId: user.id });
    void _owner;
    return Response.json({ quote }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return Response.json({ error: error instanceof BasketError ? error.code : "QUOTE_UNAVAILABLE" }, { status: error instanceof BasketError ? error.status : 503, headers: { "Cache-Control": "no-store" } }); }
}
