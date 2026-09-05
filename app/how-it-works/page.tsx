import { getCurrentUser } from "@/lib/auth/session";
import { formatProductPrice } from "@/lib/payments/format";
import { CustomerShell, PageHeader } from "../customer-shell";
import { HowToReadPrediction, PaymentTrustCard } from "../experience-components";

const stages = [
  { name: "Prematch", price: 20, className: "prematch", copy: "Evolving intelligence before kickoff. Updated Prematch intelligence remains available under the same match purchase until kickoff." },
  { name: "Live", price: 25, className: "live", copy: "Separate intelligence using actual match developments, current score and match state." },
  { name: "Halftime", price: 30, className: "halftime", copy: "Separate second-half intelligence using the evidence produced during the first half." },
];

export default async function HowItWorksPage() { const user = await getCurrentUser(); return <CustomerShell authenticated={Boolean(user)}><PageHeader eyebrow="Clear stage-based access" title="How Predictive Compass Works" description="Each stage answers a different question using the information available at that moment." /><section className="education-grid">{stages.map((stage) => <article className={`education-card ${stage.className}`} key={stage.name}><span className={`stage-badge ${stage.className}`}>{stage.name}</span><strong>{formatProductPrice(stage.price, "GHS")}</strong><p>{stage.copy}</p></article>)}</section><section className="education-detail"><HowToReadPrediction /><PaymentTrustCard /></section></CustomerShell>; }
