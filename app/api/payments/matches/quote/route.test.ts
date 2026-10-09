import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ user: vi.fn(), quote: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabaseClient: () => ({}) }));
vi.mock("@/lib/payments/basket-service", () => ({ calculateMatchBasketPrice: mocks.quote }));
vi.mock("@/lib/payments/match-pricing", async () => import("../../../../../lib/payments/match-pricing"));
vi.mock("@/lib/payments/pricing-version", async () => import("../../../../../lib/payments/pricing-version"));
import { POST } from "./route";
const id = `fm_${"a".repeat(32)}`;
const request = (body: unknown) => new Request("https://example.test/api/payments/matches/quote", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION", "v2"); mocks.user.mockResolvedValue({ id: "owner", email: "owner@example.test" }); });
afterEach(() => vi.unstubAllEnvs());
describe("basket quote authentication and boundary", () => {
  it("returns 401 before querying quotes for anonymous users", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await POST(request({ match_ids: [id] }))).status).toBe(401);
    expect(mocks.quote).not.toHaveBeenCalled();
  });
  it("rejects client amount, user override, and forecast objects", async () => {
    for (const extra of [{ amount: 1 }, { user_id: "victim" }, { shadow: {} }]) expect((await POST(request({ match_ids: [id], ...extra }))).status).toBe(400);
    expect(mocks.quote).not.toHaveBeenCalled();
  });
  it("responds with a noncached server quote without owner/internal fields", async () => {
    mocks.quote.mockResolvedValue({ id: "quote", user_id: "owner", total_pesewas: 800, fixtures: [{ match_id: id }] });
    const response = await POST(request({ match_ids: [id] })), dto = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(dto.quote).not.toHaveProperty("user_id"); expect(JSON.stringify(dto)).not.toMatch(/shadow|world_state|probabilit|research|experiment/);
    expect(mocks.quote).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner", matchIds: [id] }));
  });
});
