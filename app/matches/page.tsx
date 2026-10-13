import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { CustomerShell } from "../customer-shell";
import { PredictionsLoading, type UpcomingFilter } from "../predictions";
import { ProgressiveMatchesDashboard } from "./dashboard-stream";
import "./dashboard.css";

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ filter?: string; competition?: string }> }) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  const filter: UpcomingFilter = ["today", "tomorrow", "week"].includes(query.filter ?? "") ? query.filter as UpcomingFilter : "all";
  return <CustomerShell authenticated={Boolean(user)} theme="matches"><Suspense fallback={<PredictionsLoading />}><ProgressiveMatchesDashboard filter={filter} competition={query.competition} /></Suspense></CustomerShell>;
}
