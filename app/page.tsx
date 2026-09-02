import Link from "next/link";
import { Suspense } from "react";

import { getCurrentUser } from "../lib/auth/session";
import {
  BrandMark,
  FootballHero,
  HowToReadPrediction,
  PaymentTrustCard,
  PredictionStageSelector,
  WhyPredictiveCompass,
} from "./experience-components";
import LiveMatches from "./live-matches";
import { PredictionsContent, PredictionsLoading } from "./predictions";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div id="home" className="site-shell">
      <header className="site-header">
        <nav aria-label="Main navigation" className="top-nav">
          <Link href="/#home" className="brand"><BrandMark /><span><strong>Football</strong> Predictive Compass</span></Link>
          <div className="nav-links">
            <a href="#home">Home</a><a href="#predictions">Predictions</a><a href="#live-matches">Live</a><a href="#timeline">Timeline</a><a href="#how-it-works">How It Works</a><a href="#pricing">Access</a>
          </div>
          <div className="nav-account">
            {user ? <Link className="nav-button" href="/account"><span className="account-dot" />Account</Link> : <><Link className="login-link" href="/login">Log in</Link><Link className="nav-button" href="/register">Create account</Link></>}
          </div>
        </nav>
      </header>

      <main className="site-main">
        <FootballHero />
        <section className="intelligence-layout" aria-label="Football prediction intelligence">
          <PredictionStageSelector />
          <div className="prediction-stream">
            <section id="predictions" className="prediction-section" aria-labelledby="predictions-title">
              <div className="section-header"><div><p className="section-kicker">Match intelligence</p><h2 id="predictions-title">Available Predictions</h2><p>Prediction offers from upcoming and live fixtures.</p></div><span className="availability-pill"><span className="status-dot" />Real-time availability</span></div>
              <div className="offer-tabs" role="navigation" aria-label="Prediction offer stages"><a className="active" href="#predictions">All Offers</a><a href="#prematch">Prematch</a><a href="#live-matches">Live</a><a href="#live-matches">Halftime</a></div>
              <div id="prematch"><Suspense fallback={<PredictionsLoading />}><PredictionsContent /></Suspense></div>
            </section>
            <LiveMatches />
          </div>
          <aside className="insight-rail"><HowToReadPrediction /><PaymentTrustCard /></aside>
        </section>
        <WhyPredictiveCompass />
      </main>
      <footer className="site-footer"><div className="brand"><BrandMark /><span><strong>Football</strong> Predictive Compass</span></div><p>Premium football intelligence for fans.</p><p>Predictions are probability-based, not guaranteed outcomes.</p></footer>
    </div>
  );
}
