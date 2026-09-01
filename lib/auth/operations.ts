import type { SupabaseClient } from "@supabase/supabase-js";

import { internalAuthIdentifierForPhone } from "./internal-identifier";
import {
  loginSchema,
  registerSchema,
  type AuthActionState,
} from "./validation";

type OperationResult = AuthActionState & { redirectTo?: string };

function validationError(error: { flatten(): { fieldErrors: Record<string, string[]> } }): OperationResult {
  return { status: "error", errors: error.flatten().fieldErrors };
}

export async function registerCustomer(
  supabase: SupabaseClient,
  input: unknown,
): Promise<OperationResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const { displayName, phone, password } = parsed.data;
  const email = internalAuthIdentifierForPhone(phone);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, phone_number: phone },
    },
  });

  if (error) {
    return {
      status: "error",
      message: "We could not create your account. Please try again shortly.",
    };
  }

  if (data.session) return { status: "success", redirectTo: "/account" };
  return {
    status: "error",
    message: "Account setup is currently unavailable. Please try again later.",
  };
}

export async function loginCustomer(
  supabase: SupabaseClient,
  input: unknown,
): Promise<OperationResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { phone, password } = parsed.data;
  const email = internalAuthIdentifierForPhone(phone);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      status: "error",
      message: "Incorrect phone number or password.",
    };
  }
  return { status: "success", redirectTo: "/account" };
}

export async function logoutCustomer(supabase: SupabaseClient) {
  await supabase.auth.signOut();
  return "/";
}
