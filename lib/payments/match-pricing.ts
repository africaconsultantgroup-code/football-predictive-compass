import { z } from "zod";

// Integer pesewas throughout. Change policy here, never in a checkout component.
export const MATCH_PRICING_POLICY = {
  version: "daily-match-v2-ghs8",
  currency: "GHS",
  standardUnit: 800,
  quoteLifetimeMs: 10 * 60 * 1000,
  totals: [800, 1500, 2100, 2700, 3300, 3900, 4500, 5100, 5700, 6300],
} as const;

export const matchSelectionSchema = z.object({ match_ids: z.array(z.string().regex(/^fm_[a-f0-9]{32}$/)).min(1).max(10) }).strict();
export const basketCheckoutSchema = z.object({ quote_id: z.string().uuid() }).strict();
export type BasketFixture = { match_id: string; kickoff_at: string; competition: string; home_team: string; away_team: string };
// total_pesewas / match_count stores the exact effective price as a rational.
// A fractional pesewa is never rounded into a charge; unit is null in that case.
export type BasketPrice = { policy_version: string; currency: "GHS"; match_count: number; unit_pesewas: number | null; regular_pesewas: number; discount_pesewas: number; total_pesewas: number; tier: number };
export type BasketQuote = BasketPrice & { id: string; user_id: string; ghana_date: string; fixtures: BasketFixture[]; expires_at: string };
export class BasketError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
export function ghanaDate(kickoff: string) {
  const date = new Date(kickoff);
  if (!Number.isFinite(date.getTime())) throw new BasketError("MATCH_NOT_ELIGIBLE");
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export function matchBasketPrice(count: number): BasketPrice {
  if (!Number.isSafeInteger(count) || count < 1 || count > MATCH_PRICING_POLICY.totals.length) throw new BasketError("INVALID_SELECTION", 400);
  const total = MATCH_PRICING_POLICY.totals[count - 1];
  return { policy_version: MATCH_PRICING_POLICY.version, currency: "GHS", match_count: count, unit_pesewas: total % count === 0 ? total / count : null, regular_pesewas: count * MATCH_PRICING_POLICY.standardUnit, discount_pesewas: count * MATCH_PRICING_POLICY.standardUnit - total, total_pesewas: total, tier: count };
}
export function validateBasket(matchIds: string[], catalog: BasketFixture[], owned: Set<string>, now = new Date()) {
  if (!matchSelectionSchema.safeParse({ match_ids: matchIds }).success || new Set(matchIds).size !== matchIds.length) throw new BasketError("INVALID_SELECTION", 400);
  const fixtures = [...matchIds].sort().map(id => {
    if (owned.has(id)) throw new BasketError("ACCESS_ALREADY_GRANTED");
    const matches = catalog.filter(fixture => fixture.match_id === id);
    if (matches.length !== 1 || Date.parse(matches[0].kickoff_at) <= now.getTime() || !Number.isFinite(Date.parse(matches[0].kickoff_at))) throw new BasketError("MATCH_NOT_ELIGIBLE");
    return matches[0];
  });
  const dates = new Set(fixtures.map(fixture => ghanaDate(fixture.kickoff_at)));
  if (dates.size !== 1) throw new BasketError("SAME_GHANA_DATE_REQUIRED");
  return { ...matchBasketPrice(fixtures.length), ghana_date: [...dates][0], fixtures };
}
export function revalidateQuote(quote: BasketQuote, catalog: BasketFixture[], owned: Set<string>, now = new Date()) {
  if (Date.parse(quote.expires_at) <= now.getTime()) throw new BasketError("QUOTE_EXPIRED");
  const fresh = validateBasket(quote.fixtures.map(item => item.match_id), catalog, owned, now);
  // Postgres JSONB canonicalizes object key order. Compare identity fields,
  // never serialized key order, when validating a persisted quote.
  const sameFixtures = quote.fixtures.length === fresh.fixtures.length && fresh.fixtures.every(item => {
    const stored = quote.fixtures.find(candidate => candidate.match_id === item.match_id);
    return stored && (["match_id", "kickoff_at", "competition", "home_team", "away_team"] as const).every(field => stored[field] === item[field]);
  });
  if (quote.policy_version !== fresh.policy_version || quote.total_pesewas !== fresh.total_pesewas || quote.ghana_date !== fresh.ghana_date || !sameFixtures) throw new BasketError("BASKET_CHANGED_CONFIRM_AGAIN");
  return fresh;
}
export function formatPesewas(value: number) { return `GH₵${(value / 100).toFixed(value % 100 ? 2 : 0)}`; }
export function formatEffectivePrice(price: Pick<BasketPrice, "total_pesewas" | "match_count">) {
  const unit = price.total_pesewas / price.match_count;
  return `${price.total_pesewas % price.match_count ? "≈ " : ""}${formatPesewas(unit)}`;
}
// Receipt allocation in integer pesewas, deterministically ordered by match ID.
// This is presentation of a stored basket charge, never a checkout price.
export function allocatedMatchPesewas(quote: Pick<BasketQuote, "fixtures" | "total_pesewas" | "match_count">, matchId: string) {
  const ids = quote.fixtures.map(item => item.match_id).sort();
  const index = ids.indexOf(matchId);
  if (index < 0 || ids.length !== quote.match_count) throw new BasketError("INVALID_SELECTION");
  return Math.floor(quote.total_pesewas / quote.match_count) + (index < quote.total_pesewas % quote.match_count ? 1 : 0);
}
