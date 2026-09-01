"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "../lib/auth/session";
import {
  updateCustomerDisplayName,
  type ProfileActionState,
} from "../lib/auth/profile";
import { createCustomerAuthServerClient } from "../lib/supabase/auth-server";

export async function updateProfileAction(
  _state: ProfileActionState,
  formData: FormData,
) {
  const user = await requireUser();
  const result = await updateCustomerDisplayName(
    await createCustomerAuthServerClient(),
    user.id,
    formData.get("displayName"),
  );
  if (result.status === "success") revalidatePath("/account");
  return result;
}
