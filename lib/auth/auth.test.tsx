import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AccountDetails } from "../../app/account/page";
import { loginCustomer, logoutCustomer, registerCustomer } from "./operations";
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
  const customer = { id: "user-1", email: "ada@example.com", displayName: "Ada Fan" };

  it("renders an authenticated customer from verified claims", () => {
    expect(customerFromVerifiedClaims({ claims: {
      sub: customer.id,
      email: customer.email,
      user_metadata: { display_name: customer.displayName },
    } }, null)).toEqual(customer);
    const html = renderToStaticMarkup(<AccountDetails user={customer} />);
    expect(html).toContain("ada@example.com");
    expect(html).toContain("Ada Fan");
    expect(html).toContain("My Account");
  });

  it("redirects unauthenticated account access to login", async () => {
    const redirect = vi.fn(() => { throw new Error("REDIRECT:/login"); });
    await expect(requireUserWith(async () => null, redirect)).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledOnce();
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
