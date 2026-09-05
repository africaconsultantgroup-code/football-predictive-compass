import { getCurrentUser } from "@/lib/auth/session";
import { CustomerShell, PageHeader } from "../customer-shell";
import LiveMatches from "../live-matches";

export default async function HalftimePage() { const user = await getCurrentUser(); return <CustomerShell authenticated={Boolean(user)}><PageHeader eyebrow="Second-half outlook" title="Halftime Intelligence" description="Second-half intelligence based on what happened during the first half." accent="halftime" /><LiveMatches stage="halftime" embeddedHeading={false} /></CustomerShell>; }
