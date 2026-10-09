import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { loadPendingMatchCheckouts } from "./pending-checkout";

function database(fail = false) {
  const queries: { table: string; select?: string; user?: string }[] = [];
  const from = (table: string) => {
    const query = { table } as typeof queries[number]; queries.push(query);
    const chain = {
      select: (columns: string) => { query.select = columns; return chain; },
      eq: (column: string, value: string) => { expect(column).toBe("user_id"); query.user = value; return chain; },
      in: async () => ({ error: fail ? { message: "unavailable" } : null, data: table === "match_basket_payments" ? [{ provider_reference: "basket", status: "pending", authorization_url: "https://checkout.paystack.com/existing", match_basket_quotes: { fixtures: [{ match_id: "match", home_team: "Arsenal", away_team: "Chelsea", competition: "Premier League", kickoff_at: "2026-10-10T12:00:00Z", private_metadata: "excluded" }], total_pesewas: 800 } }] : [{ provider_reference: "legacy", status: "pending", amount: 8, currency: "GHS", prediction_access_products: { prediction_access_product_matches: [{ match_id: "legacy-match" }] } }] }),
    }; return chain;
  };
  return { client: { from } as unknown as SupabaseClient, queries };
}
describe("pending checkout recovery", () => {
  it("scopes both queries to the customer and supports the deployed legacy schema", async () => {
    const db = database();
    const results = await loadPendingMatchCheckouts(db.client, "customer");
    expect(db.queries.every(query => query.user === "customer")).toBe(true);
    expect(db.queries[1].select).not.toContain("authorization_url");
    expect(results[0].authorizationUrl).toBe("https://checkout.paystack.com/existing");
    expect(results[0].fixtures[0]).not.toHaveProperty("private_metadata");
    expect(results[1]).toMatchObject({ reference: "legacy", authorizationUrl: null, matchIds: ["legacy-match"], totalPesewas: 800 });
  });
  it("fails closed if checkout history cannot be checked", async () => {
    await expect(loadPendingMatchCheckouts(database(true).client, "customer")).rejects.toMatchObject({ code: "CHECKOUT_STATUS_UNAVAILABLE" });
  });
});
