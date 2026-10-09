"use client";

import { useActionState } from "react";

import type { AuthActionState } from "../lib/auth/validation";
import { initialAuthActionState } from "../lib/auth/validation";

type AuthAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

type Field = {
  name: "displayName" | "email" | "password" | "confirmPassword";
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
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
          <label className="text-sm font-medium text-slate-700" htmlFor={field.name}>
            {field.label}
          </label>
          <input
            autoComplete={field.autoComplete}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600/60 focus:ring-2 focus:ring-blue-600/10"
            id={field.name}
            name={field.name}
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
          className={`rounded-xl px-4 py-3 text-sm ${state.status === "success" ? "bg-blue-600/10 text-blue-800" : "bg-rose-300/10 text-rose-700"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <button
        className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
