import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { getPredictionOffers, hasPredictionAccess } from "./match-access";
const matchId = `fm_${"a".repeat(32)}`;
const access = { customer: { id: "owner", email: "safe@example.test" }, subscription: null, capabilities: new Set<string>() };
afterEach(() => vi.unstubAllEnvs());
describe("permanent full-match ownership", () => {
  it.each(["prematch", "live", "halftime"] as const)("one purchase authorizes %s including historical review", async stage => {
    vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION", "v2");
    const eq = vi.fn(() => chain), chain = { select: () => chain, eq, maybeSingle: async () => ({ data: { match_id: matchId }, error: null }) };
    const from = vi.fn(() => chain);
    expect(await hasPredictionAccess({ access, supabase: { from } as unknown as SupabaseClient, matchId, stage, now: new Date("2040-01-01") })).toBe(true);
    expect(eq).toHaveBeenCalledWith("user_id", "owner"); expect(eq).toHaveBeenCalledWith("match_id", matchId);
    expect(from).toHaveBeenCalledOnce();
  });
  it("does not grant anonymous Free users permanent access", async () => {
    vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION", "v2");
    expect(await hasPredictionAccess({ access: { ...access, customer: null }, supabase: {} as SupabaseClient, matchId, stage: "prematch" })).toBe(false);
  });
  it("does not return a separate live or halftime purchase offer", async () => {
    vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION", "v2");
    for (const stage of ["live", "halftime"] as const) expect(await getPredictionOffers({} as SupabaseClient, matchId, stage)).toEqual([]);
    expect(await getPredictionOffers({} as SupabaseClient, matchId, "prematch")).toEqual([]);
  });
});
