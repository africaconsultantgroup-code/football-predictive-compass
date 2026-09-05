import { getCurrentUser } from "@/lib/auth/session";
import { formatProductPrice } from "@/lib/payments/format";
import { getActiveMatchPricingRules } from "@/lib/payments/pricing";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { CustomerShell, PageHeader } from "../customer-shell";
import { HowToReadPrediction, PaymentTrustCard } from "../experience-components";

const stageCopy = {
  prematch: { name: "Prematch", copy: "Evolving intelligence before kickoff. Updated Prematch intelligence remains available under the same match purchase until kickoff." },
  live: { name: "Live", copy: "Separate intelligence using actual match developments, current score and match state." },
  halftime: { name: "Halftime", copy: "Separate second-half intelligence using the evidence produced during the first half." },
} as const;

export default async function HowItWorksPage() { const [user, prices] = await Promise.all([getCurrentUser(), getActiveMatchPricingRules(getServerSupabaseClient())]); return <CustomerShell authenticated={Boolean(user)}><PageHeader eyebrow="Clear stage-based access" title="How Predictive Compass Works" description="Each stage answers a different question using the information available at that moment." /><section className="education-grid">{prices.map((price) => { const stage = stageCopy[price.stage]; return <article className={`education-card ${price.stage}`} key={price.stage}><span className={`stage-badge ${price.stage}`}>{stage.name}</span><strong>{formatProductPrice(price.price, price.currency)}</strong><p>{stage.copy}</p></article>; })}</section><section className="education-detail"><HowToReadPrediction /><PaymentTrustCard /></section></CustomerShell>; }
