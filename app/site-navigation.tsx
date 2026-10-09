"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { BrandMark } from "./experience-components";

export const customerNavigation = [["Home", "/"], ["Matches", "/matches"], ["My Predictions", "/my-predictions"], ["Competitions", "/matches#competitions"], ["How It Works", "/how-it-works"], ["Account", "/account"]] as const;
const mobileDestinations = [
  ["Home", "/", "M3 10 12 3l9 7v11h-6v-7H9v7H3Z"],
  ["Matches", "/matches", "M4 4h16v16H4ZM4 9h16M9 9v11M15 9v11"],
  ["My Predictions", "/my-predictions", "M5 3h14v18H5ZM8 8h8M8 12h8M8 16h5"],
  ["Account", "/account", "M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 21v-2a8 8 0 0 1 16 0v2"],
] as const;

export function SiteNavigation({ authenticated }: { authenticated: boolean; variant?: "matches" }) {
  const [open, setOpen] = useState(false);
  const navigation = customerNavigation;
  const pathname = usePathname();
  const active = (href: string) => !href.includes("#") && (href === "/" ? pathname === "/" : pathname?.startsWith(href));
  return <><header className="site-header"><nav aria-label="Main navigation" className="top-nav">
    <Link href="/" className="brand"><BrandMark /><span><b>Predictive Compass</b><small>Predict the game. Not the hype.</small></span></Link>
    <div className="nav-links">{navigation.map(([label, href]) => <Link href={href} key={label} aria-current={active(href) ? "page" : undefined}>{label}</Link>)}</div>
    <div className="nav-account">{authenticated ? <details className="matches-account-menu"><summary><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>My Account <span aria-hidden="true">⌄</span></summary><div><Link href="/account">My Account</Link><Link href="/my-predictions">My Predictions</Link></div></details> : <><Link className="login-link" href="/login">Log in</Link><Link className="nav-button" href="/register">Create account</Link></>}</div>
    <button className="mobile-menu-button" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="matches-mobile-navigation" onClick={() => setOpen(value => !value)}>{open ? <b aria-hidden="true">×</b> : <><span /><span /><span /></>}</button>
    {open ? <div className="mobile-menu" id="matches-mobile-navigation">{navigation.map(([label, href]) => <Link href={href} key={label} aria-current={active(href) ? "page" : undefined} onClick={() => setOpen(false)}>{label}</Link>)}{authenticated ? <Link href="/account" onClick={() => setOpen(false)}>My Account</Link> : <><Link href="/login" onClick={() => setOpen(false)}>Log in</Link><Link href="/register" onClick={() => setOpen(false)}>Create account</Link></>}</div> : null}
  </nav></header><nav className="mobile-app-nav" aria-label="Mobile app navigation">{mobileDestinations.map(([label, href, path]) => <Link href={href} key={href} aria-current={active(href) ? "page" : undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={path} /></svg><span>{label}</span></Link>)}</nav></>;
}
