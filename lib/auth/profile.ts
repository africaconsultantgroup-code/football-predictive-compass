import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters.")
  .max(50, "Display name must be no more than 50 characters.");

export type CustomerProfile = {
  id: string;
  displayName: string | null;
};

export type ProfileActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: { displayName?: string[] };
};

export async function getCustomerProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<CustomerProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return { id: data.id, displayName: data.display_name };
}

export async function updateCustomerDisplayName(
  supabase: SupabaseClient,
  userId: string,
  input: unknown,
): Promise<ProfileActionState> {
  const parsed = displayNameSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      errors: { displayName: parsed.error.flatten().formErrors },
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data })
    .eq("id", userId)
    .select("id")
    .single();

  if (error || data?.id !== userId) {
    return {
      status: "error",
      message: "We could not update your profile. Please try again.",
    };
  }

  return { status: "success", message: "Name updated." };
}
