import Link from "next/link";

import { registerAction } from "../auth-actions";
import { AuthForm } from "../auth-form";
import { AuthShell } from "../auth-shell";

export default function RegisterPage() {
  return (
    <AuthShell eyebrow="Customer access" title="Create your account" description="Join Football Predictive Compass with your email address.">
      <AuthForm
        action={registerAction}
        fields={[
          { name: "displayName", label: "Display name", type: "text", autoComplete: "name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
          { name: "confirmPassword", label: "Confirm password", type: "password", autoComplete: "new-password" },
        ]}
        submitLabel="Create account"
      />
      <p className="mt-6 text-center text-sm text-slate-400">Already registered? <Link className="font-semibold text-emerald-300" href="/login">Log in</Link></p>
    </AuthShell>
  );
}
