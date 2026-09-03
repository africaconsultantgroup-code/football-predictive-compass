import { Suspense } from "react";

import { getCurrentUser } from "../lib/auth/session";
import {
  BrandMark,
  FootballHero,
  HowItWorks,
  HowToReadPrediction,
  PaymentTrustCard,
  PredictionStages,
  WhatYouGet,
  WhyPredictiveCompass,
} from "./experience-components";
import LiveMatches from "./live-matches";
import { PredictionsContent, PredictionsLoading } from "./predictions";
import { SiteNavigation } from "./site-navigation";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div id="home" className="site-shell">
      <SiteNavigation authenticated={Boolean(user)} />

      <main className="site-main">
        <FootballHero />
        <section id="upcoming-matches" className="home-section" aria-labelledby="predictions-title">
          <div className="section-header"><div><p className="section-kicker">Match intelligence</p><h2 id="predictions-title">Today&apos;s Predictions</h2><p>Browse prediction-ready fixtures ordered by kickoff time.</p></div><a className="section-link" href="#predictions">View all <span aria-hidden="true">→</span></a></div>
          <div id="predictions"><div id="prematch"><Suspense fallback={<PredictionsLoading />}><PredictionsContent /></Suspense></div></div>
        </section>
        <LiveMatches />
        <section className="home-section surface-section"><PredictionStages /></section>
        <section className="home-section split-story"><HowItWorks /></section>
        <section className="home-section surface-section"><div className="value-pair"><WhatYouGet /><HowToReadPrediction /></div></section>
        <section className="home-section"><WhyPredictiveCompass /><PaymentTrustCard /></section>
      </main>
      <footer className="site-footer"><div><div className="brand"><BrandMark /><span><b>Football Predictive</b><strong>Compass</strong></span></div><p>Predictive Compass provides probability-based football intelligence. Predictions are not guarantees of match outcomes.</p></div><nav aria-label="Footer navigation"><a href="#upcoming-matches">Predictions</a><a href="#live-matches">Live</a><a href="#how-it-works">How It Works</a><a href="/account">Account</a></nav><div className="footer-base"><span>© 2026 Football Predictive Compass</span><span>Confidence, not certainty.</span></div></footer>
    </div>
  );
}
