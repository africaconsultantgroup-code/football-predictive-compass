import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { CustomerShell, PageHeader } from "../customer-shell";
import { PredictionsContent, PredictionsLoading, type UpcomingFilter } from "../predictions";

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ filter?: string; competition?: string }> }) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  const filter: UpcomingFilter = ["today", "tomorrow", "week"].includes(query.filter ?? "") ? query.filter as UpcomingFilter : "all";
  return <CustomerShell authenticated={Boolean(user)}><PageHeader eyebrow="Prematch marketplace" title="Upcoming Matches" description="Select a match to view its latest Prematch intelligence." /><Suspense fallback={<PredictionsLoading />}><PredictionsContent filter={filter} competition={query.competition} showFilters /></Suspense></CustomerShell>;
}
