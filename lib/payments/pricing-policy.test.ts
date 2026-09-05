import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import { finalizePredictionAccessProduct } from "./pricing";

const migrationPath = "supabase/migrations/20260905014016_lower_prediction_pricing_minimum.sql";
const sql = readFileSync(migrationPath, "utf8");

const rules = {
  match: {
    prematch: { baseCount: 1, basePrice: 10, increment: 0 },
    live: { baseCount: 1, basePrice: 12.5, increment: 0 },
    halftime: { baseCount: 1, basePrice: 15, increment: 0 },
  },
  kickoff_slot: {
    prematch: { baseCount: 2, basePrice: 17.5, increment: 7.5 },
    live: { baseCount: 2, basePrice: 22.5, increment: 10 },
    halftime: { baseCount: 2, basePrice: 27.5, increment: 12.5 },
  },
} as const;

function policyPrice(scope: keyof typeof rules, stage: "prematch" | "live" | "halftime", matchCount: number) {
  if (scope === "match" && matchCount !== 1) throw new Error("invalid membership");
  if (scope === "kickoff_slot" && matchCount < 2) throw new Error("invalid membership");
  const rule = rules[scope][stage];
  return Math.max(10, rule.basePrice + (matchCount - rule.baseCount) * rule.increment);
}

describe("launch prediction pricing policy", () => {
  it.each([
    ["match", 1, 10, 12.5, 15],
    ["kickoff_slot", 2, 17.5, 22.5, 27.5],
    ["kickoff_slot", 3, 25, 32.5, 40],
    ["kickoff_slot", 4, 32.5, 42.5, 52.5],
    ["kickoff_slot", 5, 40, 52.5, 65],
    ["kickoff_slot", 6, 47.5, 62.5, 77.5],
  ] as const)("prices %s products with %i members", (scope, count, prematch, live, halftime) => {
    expect(policyPrice(scope, "prematch", count)).toBe(prematch);
    expect(policyPrice(scope, "live", count)).toBe(live);
    expect(policyPrice(scope, "halftime", count)).toBe(halftime);
  });

  it("rejects structurally invalid membership", () => {
    expect(() => policyPrice("match", "prematch", 0)).toThrow();
    expect(() => policyPrice("match", "prematch", 2)).toThrow();
    expect(() => policyPrice("kickoff_slot", "prematch", 1)).toThrow();
  });

  it("seeds all rules and calculates centrally from authoritative membership", () => {
    for (const values of [
      "('match', 'prematch', 1, 10.00::numeric, 0.00::numeric)",
      "('match', 'live', 1, 12.50::numeric, 0.00::numeric)",
      "('match', 'halftime', 1, 15.00::numeric, 0.00::numeric)",
      "('kickoff_slot', 'prematch', 2, 17.50::numeric, 7.50::numeric)",
      "('kickoff_slot', 'live', 2, 22.50::numeric, 10.00::numeric)",
      "('kickoff_slot', 'halftime', 2, 27.50::numeric, 12.50::numeric)",
    ]) expect(sql).toContain(values);
    expect(sql).toContain("join public.prediction_access_product_matches");
    expect(sql).toContain("private.calculate_prediction_product_price");
    expect(sql).not.toMatch(/requested_match_count.*auth\./i);
  });

  it("prices only valid null products and never rewrites payment snapshots", () => {
    expect(sql).toContain("where p.is_active = true");
    expect(sql).toContain("payment.status = 'successful'");
    expect(sql).not.toMatch(/update\s+public\.prediction_payments/i);
    expect(sql).not.toMatch(/update\s+public\.prediction_access_grants/i);
  });

  it("enforces the GHS 10 floor and preserves customer rule protection", () => {
    expect(sql).toContain("prediction_access_products_minimum_sellable_price");
    expect(sql).toContain("currency = 'GHS' and price_amount >= 10");
    const launchSql = readFileSync("supabase/migrations/20260903115547_launch_prediction_pricing_policy.sql", "utf8");
    expect(launchSql).toContain("alter table public.prediction_pricing_rules enable row level security");
    expect(launchSql).toContain("revoke all on table public.prediction_pricing_rules from public, anon, authenticated");
    expect(sql).not.toMatch(/grant (select|insert|update|delete).*prediction_pricing_rules.*(anon|authenticated)/i);
    expect(launchSql).toContain("revoke execute on function private.finalize_prediction_access_product(uuid)");
  });

  it("finalizes products through the service-role-only database function", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "50.00", error: null });
    await expect(finalizePredictionAccessProduct({ rpc } as never, "product-id")).resolves.toBe(50);
    expect(rpc).toHaveBeenCalledWith("finalize_prediction_access_product", {
      requested_product_id: "product-id",
    });
    const finalizerSql = readFileSync(
      "supabase/migrations/20260903115942_expose_trusted_product_pricing_finalizer.sql",
      "utf8",
    );
    expect(finalizerSql).toContain("revoke execute on function public.finalize_prediction_access_product(uuid)");
    expect(finalizerSql).toContain("grant execute on function public.finalize_prediction_access_product(uuid)\nto service_role");
  });

  it("renders explanatory stage prices from trusted database rules", () => {
    const page = readFileSync("app/how-it-works/page.tsx", "utf8");
    expect(page).toContain("getActiveMatchPricingRules(getServerSupabaseClient())");
    expect(page).not.toMatch(/price:\s*(10|12\.5|15|20|25|30)/);
  });
});
