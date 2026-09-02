import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AccountDetails } from "../../app/account/page";
import { loginCustomer, logoutCustomer, registerCustomer } from "./operations";
import { getCustomerProfile, updateCustomerDisplayName } from "./profile";
import { customerFromVerifiedClaims, requireUserWith } from "./session";
import { getPublicSupabaseConfig } from "../supabase/config";

function authClient(overrides: Record<string, unknown> = {}) {
  const auth = {
    signUp: vi.fn().mockResolvedValue({ data: { session: { access_token: "never-return-this-token" } }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { access_token: "never-return-this-token" } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
  return { auth, client: { auth } as unknown as SupabaseClient };
}

const validRegistration = {
  displayName: "Ada Fan",
  email: "ada@example.com",
  password: "safe-pass-123",
  confirmPassword: "safe-pass-123",
};

describe("email and password registration", () => {
  it("validates every registration field before calling Supabase", async () => {
    const { auth, client } = authClient();
    const result = await registerCustomer(client, {
      displayName: "A", email: "invalid", password: "short", confirmPassword: "different",
    });
    expect(result.errors).toEqual(expect.objectContaining({
      displayName: expect.any(Array), email: expect.any(Array),
      password: expect.any(Array),
    }));
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("rejects a password confirmation mismatch", async () => {
    const { auth, client } = authClient();
    const result = await registerCustomer(client, {
      ...validRegistration,
      confirmPassword: "different-pass-123",
    });
    expect(result.errors).toHaveProperty("confirmPassword");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("registers with email and cosmetic display metadata", async () => {
    const { auth, client } = authClient();
    const result = await registerCustomer(client, validRegistration);
    expect(result).toEqual({ status: "success", redirectTo: "/account" });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "safe-pass-123",
      options: { data: { display_name: "Ada Fan" } },
    });
    expect(JSON.stringify(result)).not.toContain("never-return-this-token");
  });

  it("fails safely when email confirmation prevents an immediate session", async () => {
    const { client } = authClient({
      signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    });
    await expect(registerCustomer(client, validRegistration)).resolves.toEqual({
      status: "error",
      message: "Account setup is currently unavailable. Please try again later.",
    });
  });
});

describe("email and password login and logout", () => {
  it("logs in with email using signInWithPassword", async () => {
    const { auth, client } = authClient();
    const result = await loginCustomer(client, { email: "ada@example.com", password: "safe-pass-123" });
    expect(result).toEqual({ status: "success", redirectTo: "/account" });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "safe-pass-123",
    });
    expect(auth).not.toHaveProperty("signInWithOtp");
  });

  it("returns a safe message for invalid credentials", async () => {
    const { client } = authClient({
      signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: new Error("raw Supabase credential failure") }),
    });
    const result = await loginCustomer(client, { email: "ada@example.com", password: "wrong-password" });
    expect(result.message).toBe("Incorrect email or password.");
    expect(JSON.stringify(result)).not.toContain("Supabase");
  });

  it("signs out and returns only the homepage destination", async () => {
    const { auth, client } = authClient();
    await expect(logoutCustomer(client)).resolves.toBe("/");
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
});

describe("account session protection", () => {
  const customer = { id: "user-1", email: "ada@example.com" };

  it("renders an authenticated customer from verified claims", () => {
    expect(customerFromVerifiedClaims({ claims: {
      sub: customer.id,
      email: customer.email,
    } }, null)).toEqual(customer);
    const html = renderToStaticMarkup(
      <AccountDetails user={customer} displayName="Ada Fan" access={{ customer, subscription: null, capabilities: new Set() }} />,
    );
    expect(html).toContain("ada@example.com");
    expect(html).toContain("Ada Fan");
    expect(html).toContain("Customer Account");
    expect(html).toContain("Free / Preview");
    expect(html).toContain("Prediction Access");
    expect(html).toContain("Recent Purchases");
    expect(html).toContain("No prediction access purchased yet.");
    expect(html).toContain("Browse Predictions");
    expect(html).toContain("Account Actions");
    expect(html).toContain("probability-based insights, not guaranteed outcomes");
  });

  it("shows Full Access from real subscription state", () => {
    const html = renderToStaticMarkup(
      <AccountDetails
        user={customer}
        displayName="Ada Fan"
        access={{
          customer,
          subscription: { name: "Full Access", endsAt: "2026-10-01T00:00:00.000Z" },
          capabilities: new Set(["football.prematch.full"]),
        }}
      />,
    );
    expect(html).toContain("Full Access");
    expect(html).toContain("Until 1 Oct 2026");
    expect(html).not.toContain("Free / Preview");
  });

  it("renders real grants and recent purchases as a compact dashboard", () => {
    const html = renderToStaticMarkup(<AccountDetails user={customer} displayName="Ada Fan" access={{ customer, subscription: null, capabilities: new Set() }} predictionAccess={[{
      productId: "11111111-1111-1111-1111-111111111111", name: "19:00 Kickoff Slot", stage: "prematch", scopeType: "kickoff_slot", matchCount: 3, expiresAt: null,
    }]} recentPayments={[{
      id: "payment-1", name: "19:00 Kickoff Slot", stage: "prematch", amount: 20, currency: "GHS", status: "successful", createdAt: "2026-09-02T12:00:00.000Z",
    }]} />);
    expect(html).toContain("19:00 Kickoff Slot");
    expect(html).toContain("3 matches · Kickoff Slot");
    expect(html).toContain("✓ Unlocked");
    expect(html).toContain("GHS 20.00");
    expect(html).toContain("successful");
  });

  it("redirects unauthenticated account access to login", async () => {
    const redirect = vi.fn(() => { throw new Error("REDIRECT:/login"); });
    await expect(requireUserWith(async () => null, redirect)).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledOnce();
  });
});

describe("customer profiles", () => {
  it("loads only the authenticated customer's profile id", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "user-1", display_name: "Ada Fan" },
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;

    await expect(getCustomerProfile(client, "user-1")).resolves.toEqual({
      id: "user-1",
      displayName: "Ada Fan",
    });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("updates only the authenticated customer's display name", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "user-1" }, error: null });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ update })) } as unknown as SupabaseClient;

    await expect(updateCustomerDisplayName(client, "user-1", "  Ada Updated  "))
      .resolves.toEqual({ status: "success", message: "Name updated." });
    expect(update).toHaveBeenCalledWith({ display_name: "Ada Updated" });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("rejects a response for a different customer id", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "user-2" }, error: null });
    const client = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ select: vi.fn(() => ({ single })) })),
        })),
      })),
    } as unknown as SupabaseClient;

    const result = await updateCustomerDisplayName(client, "user-1", "Ada Updated");
    expect(result.status).toBe("error");
  });

  it("creates and protects profiles by auth.users.id in the migration", () => {
    const migration = readFileSync(
      "supabase/migrations/20260901153610_customer_profiles.sql",
      "utf8",
    );
    expect(migration).toContain("values (new.id, new.raw_user_meta_data ->> 'display_name')");
    expect(migration).toContain("using ((select auth.uid()) = id)");
    expect(migration).toContain("with check ((select auth.uid()) = id)");
    expect(migration).not.toMatch(/create policy[\s\S]*for (insert|delete)/i);
  });
});

describe("customer Supabase isolation", () => {
  it("uses public auth configuration even when a server secret exists", () => {
    const config = getPublicSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "must-never-be-used",
    });
    expect(config).toEqual({ url: "https://project.supabase.co", publishableKey: "publishable-key" });
    expect(JSON.stringify(config)).not.toContain("must-never-be-used");
  });
});
