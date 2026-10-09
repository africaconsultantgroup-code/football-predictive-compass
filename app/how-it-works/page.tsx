import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { formatProductPrice } from "@/lib/payments/format";
import { getActiveMatchPricingRules } from "@/lib/payments/pricing";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { CustomerShell, PageHeader } from "../customer-shell";
import { HowToReadPrediction, PaymentTrustCard } from "../experience-components";
import { matchPricingV2Enabled } from "@/lib/payments/pricing-version";
import { MATCH_PRICING_POLICY, formatPesewas, formatEffectivePrice, matchBasketPrice } from "@/lib/payments/match-pricing";

const stageCopy = {
  prematch: { name: "Prematch", copy: "Evolving intelligence before kickoff. Updated Prematch intelligence remains available under the same match purchase until kickoff." },
  live: { name: "Live", copy: "Separate intelligence using actual match developments, current score and match state." },
  halftime: { name: "Halftime", copy: "Separate second-half intelligence using the evidence produced during the first half." },
} as const;

export default async function HowItWorksPage() {
  // Read the active pricing configuration at request time, not during prerender.
  await connection();
  const v2 = matchPricingV2Enabled();
  const [user, prices] = await Promise.all([getCurrentUser(), v2 ? Promise.resolve([]) : getActiveMatchPricingRules(getServerSupabaseClient())]);
  return <CustomerShell authenticated={Boolean(user)}><PageHeader eyebrow={v2 ? "One match, all available stages" : "Clear stage-based access"} title="How Predictive Compass Works" description={v2 ? "Keep your Free Early Forecast. Select Premium matches for the same Ghana day, review your automatic discount, and pay once." : "Each stage answers a different question using the information available at that moment."} /><section className="education-grid">{v2 ? MATCH_PRICING_POLICY.totals.map((total, index) => <article className="education-card prematch" key={index}><h2>{index + 1} {index === 0 ? "match" : "matches"}</h2><strong>{formatPesewas(total)} total</strong><strong>{formatEffectivePrice(matchBasketPrice(index + 1))} effective per match</strong><p>Across available competitions on the same Ghana calendar day. Every available Premium stage and historical review is included. Previously purchased matches stay unlocked.</p></article>) : prices.map((price) => { const stage = stageCopy[price.stage]; return <article className={`education-card ${price.stage}`} key={price.stage}><span className={`stage-badge ${price.stage}`}>{stage.name}</span><strong>{formatProductPrice(price.price, price.currency)}</strong><p>{stage.copy}</p></article>; })}</section><section className="education-detail"><HowToReadPrediction /><PaymentTrustCard /></section></CustomerShell>;
}
