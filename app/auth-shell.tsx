import { CustomerShell } from "./customer-shell";
export function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <CustomerShell authenticated={false}><section className="auth-card"><p className="section-kicker">{eyebrow}</p><h1>{title}</h1><p>{description}</p>{children}</section></CustomerShell>;
}
