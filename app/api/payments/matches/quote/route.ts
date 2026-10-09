import { getCurrentUser } from "@/lib/auth/session";
import { calculateMatchBasketPrice } from "@/lib/payments/basket-service";
import { BasketError, matchSelectionSchema } from "@/lib/payments/match-pricing";
import { matchPricingV2Enabled } from "@/lib/payments/pricing-version";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.email) return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!matchPricingV2Enabled()) return Response.json({ error: "MATCH_PRICING_NOT_ENABLED" }, { status: 503 });
  const parsed = matchSelectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "INVALID_SELECTION" }, { status: 400 });
  try {
    const { user_id: _owner, ...quote } = await calculateMatchBasketPrice({ admin: getServerSupabaseClient(), matchIds: parsed.data.match_ids, userId: user.id });
    void _owner;
    return Response.json({ quote }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return Response.json({ error: error instanceof BasketError ? error.code : "QUOTE_UNAVAILABLE" }, { status: error instanceof BasketError ? error.status : 503, headers: { "Cache-Control": "no-store" } }); }
}
