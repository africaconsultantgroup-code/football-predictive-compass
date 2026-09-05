"use client";

import Link from "next/link";
import { useState } from "react";

import { BrandMark } from "./experience-components";

export const customerNavigation = [["Home", "/"], ["Upcoming", "/matches"], ["Live", "/live"], ["Halftime", "/halftime"], ["My Predictions", "/my-predictions"], ["How It Works", "/how-it-works"], ["Account", "/account"]] as const;

export function SiteNavigation({ authenticated }: { authenticated: boolean }) {
  const [open, setOpen] = useState(false);
  return <header className="site-header"><nav aria-label="Main navigation" className="top-nav">
    <Link href="/" className="brand"><BrandMark /><span><b>Football Predictive</b><strong>Compass</strong></span></Link>
    <div className="nav-links">{customerNavigation.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</div>
    <div className="nav-account">{authenticated ? null : <><Link className="login-link" href="/login">Log in</Link><Link className="nav-button" href="/register">Create account</Link></>}</div>
    <button className="mobile-menu-button" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <b aria-hidden="true">×</b> : <><span /><span /><span /></>}</button>
    {open ? <div className="mobile-menu">{customerNavigation.map(([label, href]) => <Link href={href} key={label} onClick={() => setOpen(false)}>{label}</Link>)}{authenticated ? null : <><Link href="/login" onClick={() => setOpen(false)}>Log in</Link><Link href="/register" onClick={() => setOpen(false)}>Create account</Link></>}</div> : null}
  </nav></header>;
}
