import Link from "next/link";

import { loginAction } from "../auth-actions";
import { AuthForm } from "../auth-form";
import { AuthShell } from "../auth-shell";

export default function LoginPage() {
  return (
    <AuthShell eyebrow="Welcome back" title="Log in" description="Access your Football Predictive Compass account.">
      <AuthForm
        action={loginAction}
        fields={[
          { name: "phone", label: "Phone number", type: "tel", autoComplete: "tel", inputMode: "tel", placeholder: "0241234567" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
        submitLabel="Log in"
      />
      <p className="mt-6 text-center text-sm text-slate-400">Don&apos;t have an account? <Link className="font-semibold text-emerald-300" href="/register">Register</Link></p>
    </AuthShell>
  );
}
