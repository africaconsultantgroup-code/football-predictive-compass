import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ user: vi.fn(), quote: vi.fn(), pending: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/auth/access", () => ({ getCustomerAccess: mocks.access }));
vi.mock("@/lib/payments/pending-checkout", () => ({ loadPendingMatchCheckouts: mocks.pending }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabaseClient: () => ({}) }));
vi.mock("@/lib/payments/basket-service", () => ({ calculateMatchBasketPrice: mocks.quote }));
vi.mock("@/lib/payments/match-pricing", async () => import("../../../../../lib/payments/match-pricing"));
vi.mock("@/lib/payments/pricing-version", async () => import("../../../../../lib/payments/pricing-version"));
import { POST } from "./route";
const id = `fm_${"a".repeat(32)}`;
const request = (body: unknown) => new Request("https://example.test/api/payments/matches/quote", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.pending.mockResolvedValue([]); vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION", "v2"); mocks.user.mockResolvedValue({ id: "owner", email: "owner@example.test" }); });
afterEach(() => vi.unstubAllEnvs());
describe("basket quote authentication and boundary", () => {
  it("prevents an owner quote before any payment/reservation work", async () => {
    mocks.access.mockResolvedValueOnce({ owner: true });
    const response = await POST(request({ match_ids: [id] }));
    expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: "PREMIUM_ALREADY_UNLOCKED" });
    expect(mocks.quote).not.toHaveBeenCalled(); expect(mocks.pending).not.toHaveBeenCalled();
  });
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
  it("returns the existing customer's checkout before creating another quote", async () => {
    const pending = { reference: "fpc-basket-existing", authorizationUrl: "https://checkout.paystack.com/existing", matchIds: [id], fixtures: [], totalPesewas: 800 };
    mocks.pending.mockResolvedValue([pending]);
    const response = await POST(request({ match_ids: [id] }));
    expect(await response.json()).toEqual({ pending_checkout: pending });
    expect(mocks.pending).toHaveBeenCalledWith(expect.anything(), "owner", expect.objectContaining({ matchIds: [id], reconcile: expect.any(Function) }));
    expect(mocks.quote).not.toHaveBeenCalled(); expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
