import { z } from "zod";

const email = z.string().trim().email("Enter a valid email address.").max(254);
const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be no more than 72 characters.");

export const registerSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Display name must be at least 2 characters.")
      .max(50, "Display name must be no more than 50 characters."),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({ email, password: z.string().min(1) });

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialAuthActionState: AuthActionState = { status: "idle" };

export function fieldsFromForm(formData: FormData) {
  return {
    displayName: String(formData.get("displayName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };
}
