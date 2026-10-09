import { getCurrentUser } from "@/lib/auth/session";
import { CustomerShell, PageHeader } from "../customer-shell";
import LiveMatches from "../live-matches";

export default async function LivePage() { const user = await getCurrentUser(); return <CustomerShell authenticated={Boolean(user)}><PageHeader eyebrow="Compatibility match status" title="Live Intelligence" description="Status view for existing links. Open your owned match for evolving Premium Match Intelligence." accent="live" /><LiveMatches stage="live" embeddedHeading={false} /></CustomerShell>; }
