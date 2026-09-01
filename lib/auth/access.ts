import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createCustomerAuthServerClient } from "../supabase/auth-server";
import { getCurrentUser, type CurrentCustomer } from "./session";

export const capabilities = {
  prematchFull: "football.prematch.full",
  liveFull: "football.live.full",
  timelineFull: "football.timeline.full",
} as const;

export type CustomerCapability = (typeof capabilities)[keyof typeof capabilities];

export type CustomerAccess = {
  customer: CurrentCustomer | null;
  subscription: null | {
    name: string;
    endsAt: string | null;
  };
  capabilities: ReadonlySet<string>;
};

type SubscriptionRow = {
  user_id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  plans: {
    name: string;
    plan_entitlements: { capability: string }[];
  };
};

export async function getCustomerAccessWith(
  customer: CurrentCustomer | null,
  supabase: SupabaseClient,
  now = new Date(),
): Promise<CustomerAccess> {
  if (!customer) {
    return { customer: null, subscription: null, capabilities: new Set() };
  }

  const instant = now.toISOString();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id, status, starts_at, ends_at, plans!inner(name, plan_entitlements(capability))")
    .eq("user_id", customer.id)
    .in("status", ["active", "trialing"])
    .lte("starts_at", instant)
    .or(`ends_at.is.null,ends_at.gt.${instant}`)
    .eq("plans.is_active", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { customer, subscription: null, capabilities: new Set() };
  }

  const row = data as unknown as SubscriptionRow;
  const startsAt = new Date(row.starts_at);
  const endsAt = row.ends_at ? new Date(row.ends_at) : null;
  const valid =
    row.user_id === customer.id &&
    (row.status === "active" || row.status === "trialing") &&
    startsAt <= now &&
    (!endsAt || endsAt > now);
  if (!valid) {
    return { customer, subscription: null, capabilities: new Set() };
  }

  return {
    customer,
    subscription: { name: row.plans.name, endsAt: row.ends_at },
    capabilities: new Set(
      row.plans.plan_entitlements.map(({ capability }) => capability),
    ),
  };
}

export async function getCustomerAccess() {
  const customer = await getCurrentUser();
  const supabase = await createCustomerAuthServerClient();
  return getCustomerAccessWith(customer, supabase);
}

export function accessHasCapability(
  access: CustomerAccess,
  capability: CustomerCapability,
) {
  return access.capabilities.has(capability);
}

export async function hasCapability(capability: CustomerCapability) {
  return accessHasCapability(await getCustomerAccess(), capability);
}

export class CapabilityRequiredError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? "Authentication required." : "Full access required.");
    this.name = "CapabilityRequiredError";
  }
}

export async function requireCapability(capability: CustomerCapability) {
  const access = await getCustomerAccess();
  if (!access.customer) throw new CapabilityRequiredError(401);
  if (!accessHasCapability(access, capability)) throw new CapabilityRequiredError(403);
  return access;
}
