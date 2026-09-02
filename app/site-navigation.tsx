"use client";

import Link from "next/link";
import { useState } from "react";

import { BrandMark } from "./experience-components";

const links = [["Home", "/#home"], ["Predictions", "/#upcoming-matches"], ["Live", "/#live-matches"], ["Timeline", "/#timeline"], ["How It Works", "/#how-it-works"], ["Access", "/#pricing"]];

export function SiteNavigation({ authenticated }: { authenticated: boolean }) {
  const [open, setOpen] = useState(false);
  return <header className="site-header"><nav aria-label="Main navigation" className="top-nav">
    <Link href="/#home" className="brand"><BrandMark /><span><strong>Football</strong> Predictive Compass</span></Link>
    <div className="nav-links">{links.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</div>
    <div className="nav-account">{authenticated ? <Link className="nav-button" href="/account"><span className="account-dot" />Account</Link> : <><Link className="login-link" href="/login">Log in</Link><Link className="nav-button" href="/register">Create account</Link></>}</div>
    <button className="mobile-menu-button" type="button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span /><span /><span /></button>
    {open ? <div className="mobile-menu">{links.map(([label, href]) => <Link href={href} key={label} onClick={() => setOpen(false)}>{label}</Link>)}{authenticated ? <Link href="/account" onClick={() => setOpen(false)}>Account</Link> : <><Link href="/login" onClick={() => setOpen(false)}>Log in</Link><Link href="/register" onClick={() => setOpen(false)}>Create account</Link></>}</div> : null}
  </nav></header>;
}
