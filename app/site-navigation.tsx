"use client";

import Link from "next/link";
import { useState } from "react";

import { BrandMark } from "./experience-components";

export const customerNavigation = [["Home", "/"], ["Upcoming", "/matches"], ["Live", "/live"], ["Halftime", "/halftime"], ["My Predictions", "/my-predictions"], ["How It Works", "/how-it-works"], ["Account", "/account"]] as const;

const matchesNavigation = [["Home", "/"], ["Matches", "/matches"], ["My Predictions", "/my-predictions"], ["Competitions", "/matches#competitions"], ["How It Works", "/how-it-works"]] as const;

export function SiteNavigation({ authenticated, variant }: { authenticated: boolean; variant?: "matches" }) {
  const [open, setOpen] = useState(false);
  const navigation = variant === "matches" ? matchesNavigation : customerNavigation;
  if (variant === "matches") return <header className="site-header"><nav aria-label="Main navigation" className="top-nav">
    <Link href="/" className="brand"><BrandMark /><span><b>Predictive Compass</b><small>Predict the game. Not the hype.</small></span></Link>
    <div className="nav-links">{navigation.map(([label, href]) => <Link href={href} key={label} aria-current={label === "Matches" ? "page" : undefined}>{label}</Link>)}</div>
    <div className="nav-account">{authenticated ? <details className="matches-account-menu"><summary><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>My Account <span aria-hidden="true">⌄</span></summary><div><Link href="/account">My Account</Link><Link href="/my-predictions">My Predictions</Link></div></details> : <><Link className="login-link" href="/login">Log in</Link><Link className="nav-button" href="/register">Create account</Link></>}</div>
    <button className="mobile-menu-button" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="matches-mobile-navigation" onClick={() => setOpen(value => !value)}>{open ? <b aria-hidden="true">×</b> : <><span /><span /><span /></>}</button>
    {open ? <div className="mobile-menu" id="matches-mobile-navigation">{navigation.map(([label, href]) => <Link href={href} key={label} aria-current={label === "Matches" ? "page" : undefined} onClick={() => setOpen(false)}>{label}</Link>)}{authenticated ? <Link href="/account" onClick={() => setOpen(false)}>My Account</Link> : <><Link href="/login" onClick={() => setOpen(false)}>Log in</Link><Link href="/register" onClick={() => setOpen(false)}>Create account</Link></>}</div> : null}
  </nav></header>;
  return <header className="site-header"><nav aria-label="Main navigation" className="top-nav">
    <Link href="/" className="brand"><BrandMark /><span><b>Football Predictive</b><strong>Compass</strong></span></Link>
    <div className="nav-links">{customerNavigation.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</div>
    <div className="nav-account">{authenticated ? null : <><Link className="login-link" href="/login">Log in</Link><Link className="nav-button" href="/register">Create account</Link></>}</div>
    <button className="mobile-menu-button" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <b aria-hidden="true">×</b> : <><span /><span /><span /></>}</button>
    {open ? <div className="mobile-menu">{customerNavigation.map(([label, href]) => <Link href={href} key={label} onClick={() => setOpen(false)}>{label}</Link>)}{authenticated ? null : <><Link href="/login" onClick={() => setOpen(false)}>Log in</Link><Link href="/register" onClick={() => setOpen(false)}>Create account</Link></>}</div> : null}
  </nav></header>;
}
