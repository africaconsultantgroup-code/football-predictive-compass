import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("./config", () => ({
  getPublicSupabaseConfig: () => ({
    url: "https://project.supabase.co",
    publishableKey: "publishable-key",
  }),
}));

import { refreshCustomerSession } from "./auth-proxy";

describe("Supabase SSR session proxy", () => {
  beforeEach(() => createServerClient.mockReset());

  it("verifies claims and forwards refreshed cookies and cache headers", async () => {
    createServerClient.mockImplementation((_url, _key, options) => ({
      auth: {
        getClaims: vi.fn(async () => {
          options.cookies.setAll(
            [{ name: "sb-session", value: "refreshed", options: { httpOnly: true } }],
            { "Cache-Control": "private, no-store" },
          );
          return { data: { claims: { sub: "customer-1" } }, error: null };
        }),
      },
    }));

    const response = await refreshCustomerSession(
      new NextRequest("https://app.example/account"),
    );

    expect(createServerClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "publishable-key",
      expect.any(Object),
    );
    expect(response.cookies.get("sb-session")?.value).toBe("refreshed");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
