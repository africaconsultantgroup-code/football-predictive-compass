import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentUser, type CurrentCustomer } from "../auth/session";
import { getServerSupabaseClient } from "../supabase/server";

export type AdminIdentity = CurrentCustomer & { role: "owner" | "admin" | "operations" | "finance" | "support" };

export async function resolveAdmin(user: CurrentCustomer | null, admin: SupabaseClient): Promise<AdminIdentity | null> {
  if (!user) return null;
  const { data, error } = await admin.from("admin_users").select("role,is_active").eq("user_id", user.id).maybeSingle();
  if (error || !data?.is_active) return null;
  return { ...user, role: data.role as AdminIdentity["role"] };
}

export const getAdminIdentity = cache(async () => resolveAdmin(await getCurrentUser(), getServerSupabaseClient()));

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  const admin = await resolveAdmin(user, getServerSupabaseClient());
  if (!admin) notFound();
  return admin;
}
