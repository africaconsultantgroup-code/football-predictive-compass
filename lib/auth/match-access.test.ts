import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { commercialStage, getPredictionOffers, grantMatches, hasPredictionAccess, type PredictionGrantRow } from "./match-access";
import type { SupabaseClient } from "@supabase/supabase-js";

const a = `fm_${"a".repeat(32)}`;
const b = `fm_${"b".repeat(32)}`;
const kickoff = "2026-09-02T14:00:00.000Z";
const grant = (stage: string, matches = [a]): PredictionGrantRow => ({
  user_id: "user-1", expires_at: null,
  prediction_access_products: { is_active: true, prediction_stage: stage, prediction_access_product_matches: matches.map((match_id) => ({ match_id, kickoff_at: kickoff })) },
});

describe("match prediction access", () => {
  it("maps lifecycle stages without conflating commercial products", () => {
    expect(commercialStage("PREMATCH")).toBe("prematch");
    expect(commercialStage("FIRST_HALF_LIVE")).toBe("live");
    expect(commercialStage("HALFTIME")).toBe("halftime");
    expect(commercialStage("SECOND_HALF_LIVE")).toBe("live");
    expect(commercialStage("FINAL")).toBeNull();
  });
  it("single-match prematch grants only that match and stage", () => {
    expect(grantMatches(grant("prematch"), "user-1", a, "prematch")).toBe(true);
    expect(grantMatches(grant("prematch"), "user-1", a, "halftime")).toBe(false);
    expect(grantMatches(grant("prematch"), "user-1", b, "prematch")).toBe(false);
  });
  it("slot grants cover explicit members regardless of later kickoff changes", () => {
    const slot = grant("prematch", [a, b]);
    expect(grantMatches(slot, "user-1", a, "prematch")).toBe(true);
    expect(grantMatches(slot, "user-1", b, "prematch")).toBe(true);
    expect(grantMatches(slot, "user-1", `fm_${"c".repeat(32)}`, "prematch")).toBe(false);
  });
  it("requires distinct halftime and live grants", () => {
    expect(grantMatches(grant("halftime"), "user-1", a, "halftime")).toBe(true);
    expect(grantMatches(grant("halftime"), "user-1", a, "live")).toBe(false);
    expect(grantMatches(grant("live"), "user-1", a, "live")).toBe(true);
  });
  it("retains Full Access as an override", async () => {
    const access = { customer: { id: "user-1", email: null }, subscription: { name: "Full Access", endsAt: null }, capabilities: new Set(["football.prematch.full"]) };
    await expect(hasPredictionAccess({ access, supabase: {} as SupabaseClient, matchId: a, stage: "prematch" })).resolves.toBe(true);
  });
  it("does not offer legacy predictions without canonical match identity", async () => {
    await expect(getPredictionOffers({} as SupabaseClient, null, "prematch")).resolves.toEqual([]);
  });
  it("prevents customer mutation through grants and policies", () => {
    const sql = readFileSync("supabase/migrations/20260901201438_match_prediction_access.sql", "utf8");
    expect(sql).toContain("grant select on table public.prediction_access_grants to authenticated");
    expect(sql).not.toMatch(/grant (insert|update|delete).*prediction_access_(grants|products|product_matches).*authenticated/i);
    expect(sql).toContain("using ((select auth.uid()) = user_id)");
  });
});
