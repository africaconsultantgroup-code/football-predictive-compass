import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  accessHasCapability,
  capabilities,
  getCustomerAccessWith,
} from "./access";

const customer = { id: "user-1", email: "customer@example.com" };
const validSubscription = {
  user_id: customer.id,
  status: "active",
  starts_at: "2026-08-01T00:00:00.000Z",
  ends_at: null,
  plans: {
    name: "Full Access",
    plan_entitlements: Object.values(capabilities).map((capability) => ({ capability })),
  },
};

function subscriptionClient(data: unknown, error: unknown = null) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "in", "lte", "or", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return {
    builder,
    client: { from: vi.fn(() => builder) } as unknown as SupabaseClient,
  };
}

describe("customer subscription access", () => {
  it("gives visitors and registered customers without a subscription preview access", async () => {
    const { client } = subscriptionClient(null);
    const visitor = await getCustomerAccessWith(null, client);
    const free = await getCustomerAccessWith(customer, client);
    expect(visitor.customer).toBeNull();
    expect(free.subscription).toBeNull();
    expect(accessHasCapability(free, capabilities.prematchFull)).toBe(false);
  });

  it.each([
    capabilities.prematchFull,
    capabilities.liveFull,
    capabilities.timelineFull,
  ])("grants %s from an active plan entitlement", async (capability) => {
    const { client } = subscriptionClient(validSubscription);
    const access = await getCustomerAccessWith(customer, client);
    expect(accessHasCapability(access, capability)).toBe(true);
  });

  it("rejects a subscription row belonging to another customer", async () => {
    const { client } = subscriptionClient({ ...validSubscription, user_id: "user-2" });
    const access = await getCustomerAccessWith(customer, client, new Date("2026-09-01T12:00:00.000Z"));
    expect(access.subscription).toBeNull();
    expect(access.capabilities.size).toBe(0);
  });

  it.each([
    ["canceled", null],
    ["expired", "2026-10-01T00:00:00.000Z"],
    ["past_due", null],
    ["active", "2026-08-31T00:00:00.000Z"],
  ])("fails closed for invalid %s subscription state", async (status, endsAt) => {
    const { client } = subscriptionClient({ ...validSubscription, status, ends_at: endsAt });
    const access = await getCustomerAccessWith(customer, client, new Date("2026-09-01T12:00:00.000Z"));
    expect(access.subscription).toBeNull();
  });

  it("queries only valid active or trialing subscriptions belonging to the customer", async () => {
    const { client, builder } = subscriptionClient(null);
    await getCustomerAccessWith(customer, client, new Date("2026-09-01T12:00:00.000Z"));
    expect(builder.eq).toHaveBeenCalledWith("user_id", customer.id);
    expect(builder.in).toHaveBeenCalledWith("status", ["active", "trialing"]);
    expect(builder.lte).toHaveBeenCalledWith("starts_at", "2026-09-01T12:00:00.000Z");
    expect(builder.or).toHaveBeenCalledWith("ends_at.is.null,ends_at.gt.2026-09-01T12:00:00.000Z");
  });

  it.each(["canceled", "expired", "past_due"])("does not include %s in granting statuses", async (status) => {
    const { client, builder } = subscriptionClient(null);
    await getCustomerAccessWith(customer, client);
    expect(builder.in.mock.calls[0][1]).not.toContain(status);
  });

  it("includes trialing in granting statuses", async () => {
    const { client, builder } = subscriptionClient(null);
    await getCustomerAccessWith(customer, client);
    expect(builder.in.mock.calls[0][1]).toContain("trialing");
  });

  it("locks subscription mutation behind grants and protects ownership with RLS", () => {
    const migration = readFileSync(
      "supabase/migrations/20260901154926_subscription_entitlement_foundation.sql",
      "utf8",
    );
    expect(migration).toContain("grant select on table public.subscriptions to authenticated");
    expect(migration).toContain("using ((select auth.uid()) = user_id)");
    expect(migration).not.toMatch(/grant (insert|update|delete).*subscriptions.*authenticated/i);
    expect(migration).not.toMatch(/policy[\s\S]*subscriptions for (insert|update|delete)/i);
    expect(migration).toContain("where status in ('active', 'trialing')");
  });
});
