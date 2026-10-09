import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { allocatedMatchPesewas, formatEffectivePrice, basketCheckoutSchema, ghanaDate, matchBasketPrice, matchSelectionSchema, revalidateQuote, validateBasket, type BasketFixture, type BasketQuote } from "./match-pricing";
import { matchPricingV2Enabled } from "./pricing-version";
const now = new Date("2026-10-08T12:00:00Z");
const fixtures: BasketFixture[] = Array.from({ length: 10 }, (_, i) => ({ match_id: `fm_${i.toString(16).padStart(32, "0")}`, kickoff_at: "2026-10-09T18:00:00.000Z", competition: i % 2 ? "UEFA Champions League" : "EPL", home_team: `Home ${i}`, away_team: `Away ${i}` }));
const quote = (): BasketQuote => ({ ...validateBasket(fixtures.slice(0, 4).map(item => item.match_id), fixtures, new Set(), now), id: "11111111-1111-4111-8111-111111111111", user_id: "customer", expires_at: "2026-10-08T12:10:00Z" });
afterEach(() => vi.unstubAllEnvs());
describe("Pricing V2", () => {
  it.each([[1,800,800],[2,750,1500],[3,700,2100],[4,675,2700],[5,660,3300],[6,650,3900],[7,null,4500],[8,null,5100],[9,null,5700],[10,630,6300]])("%i matches costs integer pesewas", (count, unit, total) => {
    expect(matchBasketPrice(count)).toMatchObject({ match_count: count, currency: "GHS", unit_pesewas: unit, total_pesewas: total, discount_pesewas: count * 800 - total });
  });
  it("rejects an old unaccepted price without rewriting its snapshot", () => {
    const old = { ...quote(), policy_version: "daily-match-v2", total_pesewas: 6400 };
    expect(() => revalidateQuote(old, fixtures, new Set(), now)).toThrow("BASKET_CHANGED_CONFIRM_AGAIN");
    expect(old.total_pesewas).toBe(6400);
  });
  it.each([7,8,9])("keeps exact effective rational and integer receipt allocations for %i", count => {
    const q = { ...quote(), ...matchBasketPrice(count), fixtures: fixtures.slice(0,count) };
    expect(q.unit_pesewas).toBeNull();
    expect(formatEffectivePrice(q)).toContain("≈");
    const allocated = q.fixtures.map(f => allocatedMatchPesewas(q,f.match_id));
    expect(allocated.every(Number.isInteger)).toBe(true);
    expect(allocated.reduce((a,b)=>a+b,0)).toBe(q.total_pesewas);
  });
  it("five-match savings is exactly 700 pesewas", () => expect(matchBasketPrice(5)).toMatchObject({ regular_pesewas:4000,total_pesewas:3300,discount_pesewas:700 }));
  it("never decreases total as a match is added, through the bounded checkout limit", () => {
    for (let count = 2; count <= 10; count++) expect(matchBasketPrice(count).total_pesewas).toBeGreaterThan(matchBasketPrice(count - 1).total_pesewas);
  });
  it.each([0,-1,1.5,11,101,NaN])("rejects invalid count %s", count => expect(() => matchBasketPrice(count)).toThrow("INVALID_SELECTION"));
  it("discounts across available competitions", () => expect(validateBasket(fixtures.slice(0,4).map(item => item.match_id), fixtures, new Set(), now)).toMatchObject({ total_pesewas: 2700, match_count: 4 }));
  it("uses Ghana midnight across source offsets", () => {
    expect(ghanaDate("2026-10-09T00:30:00+01:00")).toBe("2026-10-08");
    expect(ghanaDate("2026-10-08T20:30:00-04:00")).toBe("2026-10-09");
    expect(ghanaDate("2026-10-09T00:00:00Z")).toBe("2026-10-09");
  });
  it("rejects a basket spanning Ghana midnight", () => {
    const changed = [{ ...fixtures[0], kickoff_at: "2026-10-09T23:59:59Z" }, { ...fixtures[1], kickoff_at: "2026-10-10T00:00:00Z" }];
    expect(() => validateBasket(changed.map(item => item.match_id), changed, new Set(), now)).toThrow("SAME_GHANA_DATE_REQUIRED");
  });
  it("rejects duplicate selections", () => expect(() => validateBasket([fixtures[0].match_id,fixtures[0].match_id], fixtures, new Set(), now)).toThrow("INVALID_SELECTION"));
  it("rejects malformed and unknown identity", () => {
    expect(() => validateBasket(["123"], fixtures, new Set(), now)).toThrow("INVALID_SELECTION");
    expect(() => validateBasket([`fm_${"f".repeat(32)}`], fixtures, new Set(), now)).toThrow("MATCH_NOT_ELIGIBLE");
  });
  it("does not count already-owned matches or discount previous purchases", () => expect(() => validateBasket([fixtures[0].match_id], fixtures, new Set([fixtures[0].match_id]), now)).toThrow("ACCESS_ALREADY_GRANTED"));
  it("rejects invalid dates and fixtures whose purchase window ended", () => {
    for (const kickoff_at of ["invalid", now.toISOString()]) expect(() => validateBasket([fixtures[0].match_id], [{ ...fixtures[0], kickoff_at }], new Set(), now)).toThrow("MATCH_NOT_ELIGIBLE");
  });
  it("expires quotes at the exact boundary", () => expect(() => revalidateQuote(quote(), fixtures, new Set(), new Date(quote().expires_at))).toThrow("QUOTE_EXPIRED"));
  it("requires confirmation for moved fixtures even if the discount is unchanged", () => expect(() => revalidateQuote(quote(), fixtures.map(item => ({ ...item, kickoff_at: "2026-10-10T18:00:00.000Z" })), new Set(), now)).toThrow("BASKET_CHANGED_CONFIRM_AGAIN"));
  it("requires confirmation for identity changes", () => expect(() => revalidateQuote(quote(), fixtures.map(item => ({ ...item, away_team: "New opponent" })), new Set(), now)).toThrow("BASKET_CHANGED_CONFIRM_AGAIN"));
  it("rechecks newly granted ownership at acceptance", () => expect(() => revalidateQuote(quote(), fixtures, new Set([fixtures[0].match_id]), now)).toThrow("ACCESS_ALREADY_GRANTED"));
  it("accepts an unchanged quote without deriving new forecasts", () => expect(revalidateQuote(quote(), fixtures, new Set(), now).total_pesewas).toBe(2700));
  it("accepts persisted JSONB identity objects with reordered keys", () => {
    const stored = quote();
    stored.fixtures = stored.fixtures.map(item => ({ away_team:item.away_team,home_team:item.home_team,kickoff_at:item.kickoff_at,match_id:item.match_id,competition:item.competition }));
    expect(revalidateQuote(stored, fixtures, new Set(), now).total_pesewas).toBe(2700);
  });
  it("rejects browser pricing and currency on both inputs", () => {
    expect(matchSelectionSchema.safeParse({ match_ids: [fixtures[0].match_id], amount: 1 }).success).toBe(false);
    expect(basketCheckoutSchema.safeParse({ quote_id: quote().id, currency: "NGN" }).success).toBe(false);
    expect(basketCheckoutSchema.safeParse({ quote_id: quote().id, match_ids: [] }).success).toBe(false);
  });
  it("requires deliberate activation after migrating, leaving production unchanged", () => {
    vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION", ""); expect(matchPricingV2Enabled()).toBe(false);
    vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION", "v2"); expect(matchPricingV2Enabled()).toBe(true);
  });
});
