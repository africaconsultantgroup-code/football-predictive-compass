"use client";

import { useActionState } from "react";

import { updateProfileAction } from "../profile-actions";
import type { ProfileActionState } from "../../lib/auth/profile";

const initialProfileActionState: ProfileActionState = { status: "idle" };

export function ProfileForm({ displayName }: { displayName: string | null }) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialProfileActionState,
  );

  return (
    <form action={formAction} className="mt-8 border-t border-white/10 pt-8">
      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="displayName">
        Update name
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          autoComplete="name"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10"
          defaultValue={displayName ?? ""}
          id="displayName"
          maxLength={50}
          minLength={2}
          name="displayName"
          required
          type="text"
        />
        <button
          className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving…" : "Save name"}
        </button>
      </div>
      {state.errors?.displayName?.map((error) => (
        <p className="mt-2 text-sm text-rose-300" key={error}>{error}</p>
      ))}
      {state.message ? (
        <p className={`mt-3 text-sm ${state.status === "success" ? "text-emerald-300" : "text-rose-300"}`} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
