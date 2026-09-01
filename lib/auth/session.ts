import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createCustomerAuthServerClient } from "../supabase/auth-server";

export type CurrentCustomer = {
  id: string;
  email: string | null;
};

export function customerFromVerifiedClaims(
  data: { claims?: Record<string, unknown> } | null,
  error: unknown,
): CurrentCustomer | null {
  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== "string") return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
}

export const getCurrentUser = cache(async (): Promise<CurrentCustomer | null> => {
  const supabase = await createCustomerAuthServerClient();
  const { data, error } = await supabase.auth.getClaims();
  return customerFromVerifiedClaims(data, error);
});

export async function requireUserWith(
  loadUser: () => Promise<CurrentCustomer | null>,
  redirectToLogin: () => never,
) {
  const user = await loadUser();
  if (!user) return redirectToLogin();
  return user;
}

export async function requireUser() {
  return requireUserWith(getCurrentUser, () => redirect("/login"));
}
