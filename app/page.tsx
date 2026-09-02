import { Suspense } from "react";

import { getCurrentUser } from "../lib/auth/session";
import {
  BrandMark,
  FootballHero,
  HowItWorks,
  HowToReadPrediction,
  PaymentTrustCard,
  PredictionStages,
  PredictionStageSelector,
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
        <section className="intelligence-layout" aria-label="Football prediction intelligence">
          <PredictionStageSelector />
          <div className="prediction-stream">
            <section id="upcoming-matches" className="prediction-section" aria-labelledby="predictions-title">
              <div className="section-header"><div><p className="section-kicker">Next fixtures</p><h2 id="predictions-title">Upcoming Matches</h2><p>Explore real upcoming fixtures and available prediction access.</p></div><span className="availability-pill"><span className="status-dot" />Real-time availability</span></div>
              <div className="offer-tabs" role="navigation" aria-label="Prediction offer stages"><a className="active" href="#predictions">All Offers</a><a href="#prematch">Prematch</a><a href="#live-matches">Live</a><a href="#live-matches">Halftime</a></div>
              <div id="predictions"><div id="prematch"><Suspense fallback={<PredictionsLoading />}><PredictionsContent /></Suspense></div></div>
            </section>
            <LiveMatches />
          </div>
          <aside className="insight-rail"><HowToReadPrediction /><PaymentTrustCard /></aside>
        </section>
        <PredictionStages />
        <HowItWorks />
        <WhatYouGet />
        <WhyPredictiveCompass />
      </main>
      <footer className="site-footer"><div className="brand"><BrandMark /><span><strong>Football</strong> Predictive Compass</span></div><p>Premium football intelligence for fans.</p><p>Predictions are probability-based, not guaranteed outcomes.</p></footer>
    </div>
  );
}
