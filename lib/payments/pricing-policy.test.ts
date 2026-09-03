import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import { finalizePredictionAccessProduct } from "./pricing";

const migrationPath = "supabase/migrations/20260903115547_launch_prediction_pricing_policy.sql";
const sql = readFileSync(migrationPath, "utf8");

const rules = {
  match: {
    prematch: { baseCount: 1, basePrice: 20, increment: 0 },
    live: { baseCount: 1, basePrice: 25, increment: 0 },
    halftime: { baseCount: 1, basePrice: 30, increment: 0 },
  },
  kickoff_slot: {
    prematch: { baseCount: 2, basePrice: 35, increment: 15 },
    live: { baseCount: 2, basePrice: 45, increment: 20 },
    halftime: { baseCount: 2, basePrice: 55, increment: 25 },
  },
} as const;

function policyPrice(scope: keyof typeof rules, stage: "prematch" | "live" | "halftime", matchCount: number) {
  if (scope === "match" && matchCount !== 1) throw new Error("invalid membership");
  if (scope === "kickoff_slot" && matchCount < 2) throw new Error("invalid membership");
  const rule = rules[scope][stage];
  return Math.max(20, rule.basePrice + (matchCount - rule.baseCount) * rule.increment);
}

describe("launch prediction pricing policy", () => {
  it.each([
    ["match", 1, 20, 25, 30],
    ["kickoff_slot", 2, 35, 45, 55],
    ["kickoff_slot", 3, 50, 65, 80],
    ["kickoff_slot", 4, 65, 85, 105],
    ["kickoff_slot", 5, 80, 105, 130],
    ["kickoff_slot", 6, 95, 125, 155],
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
      "('match', 'prematch', 'GHS', 1, 20, 0, 20)",
      "('match', 'live', 'GHS', 1, 25, 0, 20)",
      "('match', 'halftime', 'GHS', 1, 30, 0, 20)",
      "('kickoff_slot', 'prematch', 'GHS', 2, 35, 15, 20)",
      "('kickoff_slot', 'live', 'GHS', 2, 45, 20, 20)",
      "('kickoff_slot', 'halftime', 'GHS', 2, 55, 25, 20)",
    ]) expect(sql).toContain(values);
    expect(sql).toContain("from public.prediction_access_product_matches");
    expect(sql).toContain("private.calculate_prediction_product_price");
    expect(sql).not.toMatch(/requested_match_count.*auth\./i);
  });

  it("prices only valid null products and never rewrites payment snapshots", () => {
    expect(sql).toContain("where p.price_amount is null");
    expect(sql).toContain("and price_amount is null");
    expect(sql).toContain("if product_record.price_amount is not null then return product_record.price_amount");
    expect(sql).toContain("if exists (select 1 from public.prediction_payments");
    expect(sql).not.toMatch(/update\s+public\.prediction_payments/i);
  });

  it("enforces the GHS 20 floor and denies customer rule mutation", () => {
    expect(sql).toContain("prediction_access_products_minimum_sellable_price");
    expect(sql).toContain("currency = 'GHS' and price_amount >= 20");
    expect(sql).toContain("alter table public.prediction_pricing_rules enable row level security");
    expect(sql).toContain("revoke all on table public.prediction_pricing_rules from public, anon, authenticated");
    expect(sql).not.toMatch(/grant (select|insert|update|delete).*prediction_pricing_rules.*(anon|authenticated)/i);
    expect(sql).toContain("revoke execute on function private.finalize_prediction_access_product(uuid)");
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
});
