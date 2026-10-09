import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { CustomerShell, PageHeader } from "../customer-shell";
import { HowToReadPrediction, PaymentTrustCard } from "../experience-components";
import { MATCH_PRICING_POLICY, formatPesewas, formatEffectivePrice, matchBasketPrice } from "@/lib/payments/match-pricing";

export default async function HowItWorksPage() {
  // Read the active pricing configuration at request time, not during prerender.
  await connection();
  const user = await getCurrentUser();
  return <CustomerShell authenticated={Boolean(user)}><PageHeader eyebrow="One match, all available stages" title="How Predictive Compass Works" description="Keep your Free Early Forecast. Select Premium matches for the same Ghana day, review your automatic discount, and pay once." /><section className="education-card"><h2>Free Pre-Match</h2><p>Available without payment when a genuine stored Free forecast exists. Free and Premium forecasts remain separately identifiable.</p><h2>Premium Match Intelligence</h2><p>One purchase keeps the match unlocked across available stages and historical review. Live and halftime intelligence appears only when supported and available for that fixture.</p></section><section className="education-grid">{MATCH_PRICING_POLICY.totals.map((total, index) => <article className="education-card prematch" key={index}><h2>{index + 1} {index === 0 ? "match" : "matches"}</h2><strong>{formatPesewas(total)} total</strong><strong>{formatEffectivePrice(matchBasketPrice(index + 1))} effective per match</strong><p>Across available competitions on the same Ghana calendar day. Previously purchased matches stay unlocked.</p></article>)}</section><section className="education-detail"><HowToReadPrediction /><PaymentTrustCard /></section></CustomerShell>;
}
