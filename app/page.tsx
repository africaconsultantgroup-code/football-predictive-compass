import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { CustomerShell } from "./customer-shell";
import { FootballHero, PredictionStages, WhatYouGet, WhyPredictiveCompass } from "./experience-components";
import LiveMatches from "./live-matches";
import { PredictionsContent, PredictionsLoading } from "./predictions";

export default async function Home() {
  const user = await getCurrentUser();
  return <CustomerShell authenticated={Boolean(user)}><div className="landing-page"><FootballHero />
    <section className="overview-section" aria-labelledby="next-up-title"><div className="overview-heading"><div><p className="section-kicker">Next up</p><h2 id="next-up-title">Upcoming Matches</h2><p>The nearest fixtures with customer-ready Prematch intelligence.</p></div><Link className="section-link" href="/matches">View All Upcoming Matches →</Link></div><Suspense fallback={<PredictionsLoading />}><PredictionsContent limit={4} showSlots={false} /></Suspense></section>
    <section className="overview-section surface-band" aria-labelledby="live-now-title"><div className="overview-heading"><div><p className="section-kicker live-text">Live now</p><h2 id="live-now-title">Live Intelligence</h2><p>Predictions responding to the developing match state.</p></div><Link className="section-link live-text" href="/live">View Live Intelligence →</Link></div><LiveMatches stage="live" compact embeddedHeading={false} /></section>
    <section className="overview-section"><PredictionStages /></section>
    <section className="overview-section surface-band"><div className="value-pair"><WhatYouGet /><WhyPredictiveCompass /></div></section>
  </div></CustomerShell>;
}
