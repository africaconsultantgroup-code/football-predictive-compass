import { getCurrentUser } from "@/lib/auth/session";
import { CustomerShell, PageHeader } from "../customer-shell";
import LiveMatches from "../live-matches";

export default async function LivePage() { const user = await getCurrentUser(); return <CustomerShell authenticated={Boolean(user)}><PageHeader eyebrow="Match centre" title="Live Intelligence" description="Predictions updated using the developing match state." accent="live" /><LiveMatches stage="live" embeddedHeading={false} /></CustomerShell>; }
