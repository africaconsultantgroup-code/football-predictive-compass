import { getCurrentUser } from "@/lib/auth/session";
import { CustomerShell, PageHeader } from "../customer-shell";
import LiveMatches from "../live-matches";

export default async function HalftimePage() { const user = await getCurrentUser(); return <CustomerShell authenticated={Boolean(user)}><PageHeader eyebrow="Compatibility match status" title="Halftime Intelligence" description="Status view for existing links. Second-half intelligence is included on your owned match when supported." accent="halftime" /><LiveMatches stage="halftime" embeddedHeading={false} /></CustomerShell>; }
