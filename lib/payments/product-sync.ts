import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { FootballLiveMatch, FootballPrediction } from "../predictive-compass/schema";
import { footballMatchIdSchema } from "../predictive-compass/schema";
import { getServerSupabaseClient } from "../supabase/server";
import { finalizePredictionAccessProduct } from "./pricing";

export type SyncStage = "prematch" | "live" | "halftime";

export type EligiblePrediction = {
  matchId: string;
  kickoffAt: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  stage: SyncStage;
};

export type ProductSpec = {
  syncKey: string;
  scopeType: "match" | "kickoff_slot";
  stage: SyncStage;
  name: string;
  members: Array<{ match_id: string; kickoff_at: string }>;
  salesOpenAt: string | null;
  salesCloseAt: string | null;
};

export type ProductSyncReport = {
  created: number;
  existing: number;
  priced: number;
  deactivated: number;
  skipped: number;
};

function validKickoff(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function eligibleUpcomingPredictions(predictions: FootballPrediction[]) {
  const eligible: EligiblePrediction[] = [];
  let skipped = 0;
  for (const prediction of predictions) {
    const kickoffAt = validKickoff(prediction.kickoff_at);
    if (prediction.stage !== "PREMATCH" || !footballMatchIdSchema.safeParse(prediction.match_id).success || !kickoffAt) {
      skipped += 1;
      continue;
    }
    eligible.push({
      matchId: prediction.match_id!, kickoffAt, competition: prediction.competition,
      homeTeam: prediction.home_team, awayTeam: prediction.away_team, stage: "prematch",
    });
  }
  return { eligible, skipped };
}

export function eligibleLivePredictions(matches: FootballLiveMatch[]) {
  const eligible: EligiblePrediction[] = [];
  let skipped = 0;
  for (const match of matches) {
    const kickoffAt = validKickoff(match.kickoff_at);
    const stage = match.stage === "HALFTIME"
      ? "halftime"
      : match.stage === "FIRST_HALF_LIVE" || match.stage === "SECOND_HALF_LIVE"
        ? "live"
        : null;
    if (!stage || !match.latest_prediction || !kickoffAt) {
      skipped += 1;
      continue;
    }
    eligible.push({
      matchId: match.match_id, kickoffAt, competition: match.competition,
      homeTeam: match.home_team, awayTeam: match.away_team, stage,
    });
  }
  return { eligible, skipped };
}

function slotFingerprint(matchIds: string[]) {
  return createHash("sha256").update([...matchIds].sort().join("|")).digest("hex").slice(0, 20);
}

export function planPredictionProducts(predictions: EligiblePrediction[], now = new Date()): ProductSpec[] {
  const unique = [...new Map(predictions.map((prediction) => [`${prediction.stage}:${prediction.matchId}`, prediction])).values()];
  const products: ProductSpec[] = unique.map((prediction) => ({
    syncKey: `core:${prediction.stage}:match:${prediction.matchId}`,
    scopeType: "match",
    stage: prediction.stage,
    name: `${prediction.homeTeam} vs ${prediction.awayTeam} · ${prediction.stage === "prematch" ? "Prematch" : prediction.stage === "live" ? "Live" : "Halftime"}`,
    members: [{ match_id: prediction.matchId, kickoff_at: prediction.kickoffAt }],
    salesOpenAt: prediction.stage === "prematch" ? null : now.toISOString(),
    salesCloseAt: prediction.stage === "prematch" ? prediction.kickoffAt : null,
  }));

  const groups = new Map<string, EligiblePrediction[]>();
  for (const prediction of unique) {
    const key = `${prediction.stage}:${prediction.kickoffAt}`;
    groups.set(key, [...(groups.get(key) ?? []), prediction]);
  }
  for (const matches of groups.values()) {
    if (matches.length < 2) continue;
    const first = matches[0];
    const ids = matches.map((match) => match.matchId).sort();
    products.push({
      syncKey: `core:${first.stage}:slot:${first.kickoffAt}:${slotFingerprint(ids)}`,
      scopeType: "kickoff_slot",
      stage: first.stage,
      name: `${first.stage === "prematch" ? "Prematch" : first.stage === "live" ? "Live" : "Halftime"} kickoff slot · ${matches.length} matches`,
      members: matches.map((match) => ({ match_id: match.matchId, kickoff_at: match.kickoffAt })),
      salesOpenAt: first.stage === "prematch" ? null : now.toISOString(),
      salesCloseAt: first.stage === "prematch" ? first.kickoffAt : null,
    });
  }
  return products;
}

export async function ensureProduct(admin: SupabaseClient, spec: ProductSpec, report: ProductSyncReport) {
  let lookup = await admin.from("prediction_access_products")
    .select("id, price_amount, is_active").eq("sync_key", spec.syncKey).maybeSingle();
  if (!lookup.data) {
    const inserted = await admin.from("prediction_access_products").insert({
      sync_key: spec.syncKey, scope_type: spec.scopeType, prediction_stage: spec.stage,
      name: spec.name, price_amount: null, currency: "GHS", is_active: true,
      sales_open_at: spec.salesOpenAt, sales_close_at: spec.salesCloseAt,
    }).select("id, price_amount, is_active").single();
    if (inserted.error) {
      lookup = await admin.from("prediction_access_products")
        .select("id, price_amount, is_active").eq("sync_key", spec.syncKey).maybeSingle();
    } else {
      lookup = inserted;
      report.created += 1;
    }
  } else {
    report.existing += 1;
  }
  if (!lookup.data) throw new Error("Prediction product synchronization failed.");
  if (!lookup.data.is_active) {
    const reactivated = await admin.from("prediction_access_products").update({
      is_active: true,
      sales_open_at: spec.salesOpenAt,
      sales_close_at: spec.salesCloseAt,
    }).eq("id", lookup.data.id);
    if (reactivated.error) throw new Error("Prediction product reactivation failed.");
  }
  if (lookup.data.price_amount !== null) return;

  const membership = await admin.from("prediction_access_product_matches")
    .upsert(spec.members.map((member) => ({ product_id: lookup.data!.id, ...member })), { onConflict: "product_id,match_id" });
  if (membership.error) throw new Error("Prediction product membership synchronization failed.");
  await finalizePredictionAccessProduct(admin, lookup.data.id);
  report.priced += 1;
}

async function deactivateStaleProducts(admin: SupabaseClient, stages: SyncStage[], activeKeys: Set<string>) {
  if (!stages.length) return 0;
  const existing = await admin.from("prediction_access_products")
    .select("id, sync_key, is_active").in("prediction_stage", stages).like("sync_key", "core:%");
  if (existing.error || !existing.data) throw new Error("Prediction product availability synchronization failed.");
  const stale = existing.data.filter((product) => product.is_active && product.sync_key && !activeKeys.has(product.sync_key));
  for (const product of stale) {
    const result = await admin.from("prediction_access_products").update({ is_active: false }).eq("id", product.id);
    if (result.error) throw new Error("Prediction product availability synchronization failed.");
  }
  return stale.length;
}

export async function syncEligiblePredictionProducts(
  eligible: EligiblePrediction[],
  skipped = 0,
  admin: SupabaseClient = getServerSupabaseClient(),
  now = new Date(),
  managedStages: SyncStage[] = [...new Set(eligible.map((prediction) => prediction.stage))],
): Promise<ProductSyncReport> {
  const report = { created: 0, existing: 0, priced: 0, deactivated: 0, skipped };
  const specs = planPredictionProducts(eligible, now);
  for (const spec of specs) await ensureProduct(admin, spec, report);
  report.deactivated = await deactivateStaleProducts(admin, managedStages, new Set(specs.map((spec) => spec.syncKey)));
  return report;
}

export async function syncUpcomingPredictionProducts(predictions: FootballPrediction[]) {
  const { eligible, skipped } = eligibleUpcomingPredictions(predictions);
  return syncEligiblePredictionProducts(eligible, skipped, getServerSupabaseClient(), new Date(), ["prematch"]);
}

export async function syncLivePredictionProducts(matches: FootballLiveMatch[]) {
  const { eligible, skipped } = eligibleLivePredictions(matches);
  return syncEligiblePredictionProducts(eligible, skipped, getServerSupabaseClient(), new Date(), ["live", "halftime"]);
}
