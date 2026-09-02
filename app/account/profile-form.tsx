"use client";

import { useActionState, useState } from "react";

import { updateProfileAction } from "../profile-actions";
import type { ProfileActionState } from "../../lib/auth/profile";

const initialProfileActionState: ProfileActionState = { status: "idle" };

export function ProfileForm({ displayName }: { displayName: string | null }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateProfileAction, initialProfileActionState);

  if (!editing) {
    return <button className="edit-profile-button" type="button" onClick={() => setEditing(true)}>Edit Profile</button>;
  }

  return (
    <form action={formAction} className="profile-editor">
      <div className="account-section-title"><div><p className="section-kicker">Profile details</p><h2>Edit Profile</h2></div><button className="text-action" type="button" onClick={() => setEditing(false)}>Cancel</button></div>
      <label htmlFor="displayName">Name</label>
      <div className="profile-controls">
        <input autoComplete="name" defaultValue={displayName ?? ""} id="displayName" maxLength={50} minLength={2} name="displayName" required type="text" />
        <button className="save-profile-button" disabled={pending} type="submit">{pending ? "Saving…" : "Save Changes"}</button>
      </div>
      {state.errors?.displayName?.map((error) => <p className="profile-error" key={error}>{error}</p>)}
      {state.message ? <p className={state.status === "success" ? "profile-success" : "profile-error"} role="status">{state.message}</p> : null}
    </form>
  );
}
