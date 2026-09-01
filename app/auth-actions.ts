"use server";

import { redirect } from "next/navigation";

import {
  loginCustomer,
  logoutCustomer,
  registerCustomer,
} from "../lib/auth/operations";
import {
  fieldsFromForm,
  type AuthActionState,
} from "../lib/auth/validation";
import { createCustomerAuthServerClient } from "../lib/supabase/auth-server";

export async function registerAction(
  _state: AuthActionState,
  formData: FormData,
) {
  const result = await registerCustomer(
    await createCustomerAuthServerClient(),
    fieldsFromForm(formData),
  );
  if (result.redirectTo) redirect(result.redirectTo);
  return result;
}

export async function loginAction(
  _state: AuthActionState,
  formData: FormData,
) {
  const result = await loginCustomer(
    await createCustomerAuthServerClient(),
    fieldsFromForm(formData),
  );
  if (result.redirectTo) redirect(result.redirectTo);
  return result;
}

export async function logoutAction() {
  redirect(
    await logoutCustomer(await createCustomerAuthServerClient()),
  );
}
