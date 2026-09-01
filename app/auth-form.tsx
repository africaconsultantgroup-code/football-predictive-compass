"use client";

import { useActionState } from "react";

import type { AuthActionState } from "../lib/auth/validation";
import { initialAuthActionState } from "../lib/auth/validation";

type AuthAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

type Field = {
  name: "displayName" | "phone" | "password" | "confirmPassword";
  label: string;
  type: "text" | "tel" | "password";
  autoComplete: string;
  inputMode?: "tel";
  placeholder?: string;
};

export function AuthForm({
  action,
  fields,
  submitLabel,
}: {
  action: AuthAction;
  fields: Field[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAuthActionState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {fields.map((field) => (
        <div key={field.name}>
          <label className="text-sm font-medium text-slate-200" htmlFor={field.name}>
            {field.label}
          </label>
          <input
            autoComplete={field.autoComplete}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10"
            id={field.name}
            inputMode={field.inputMode}
            name={field.name}
            placeholder={field.placeholder}
            required
            type={field.type}
          />
          {state.errors?.[field.name]?.map((error) => (
            <p className="mt-2 text-sm text-rose-300" key={error}>{error}</p>
          ))}
        </div>
      ))}
      {state.message ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${state.status === "success" ? "bg-emerald-300/10 text-emerald-200" : "bg-rose-300/10 text-rose-200"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <button
        className="w-full rounded-xl bg-emerald-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
