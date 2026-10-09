import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "./experience-components";
import { SiteNavigation } from "./site-navigation";

export function PageHeader({ eyebrow, title, description, accent = "prematch" }: { eyebrow: string; title: string; description: string; accent?: "prematch" | "live" | "halftime" }) {
  return <header className={`page-header page-header-${accent}`}><p className="section-kicker">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>;
}

export function EmptyState({ title, description, href, action }: { title: string; description: string; href?: string; action?: string }) {
  return <div className="customer-empty"><span aria-hidden="true">⌁</span><h2>{title}</h2><p>{description}</p>{href && action ? <Link className="secondary-button" href={href}>{action}</Link> : null}</div>;
}

export function AppFooter() {
  return <footer className="site-footer"><div><div className="brand"><BrandMark /><span><b>Predictive Compass</b><small>Predict the game. Not the hype.</small></span></div><p>Probability-based football intelligence that evolves with the information available at each stage.</p></div><nav aria-label="Footer navigation"><Link href="/matches">Upcoming</Link><Link href="/my-predictions">My Predictions</Link><Link href="/account">Account</Link><Link href="/how-it-works">How It Works</Link></nav><div className="footer-base"><span>© 2026 Football Predictive Compass</span><span>Confidence, not certainty.</span></div></footer>;
}

export function CustomerShell({ authenticated, children }: { authenticated: boolean; children: ReactNode; theme?: "matches" }) {
  return <div className="site-shell matches-theme"><SiteNavigation authenticated={authenticated} /><main className="page-container">{children}</main><AppFooter /></div>;
}
