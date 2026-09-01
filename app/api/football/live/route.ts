import { getLiveFootballMatches } from "@/lib/predictive-compass/server";
import { createLiveListHandler } from "@/lib/predictive-compass/live-routes";

export const dynamic = "force-dynamic";
export const GET = createLiveListHandler(getLiveFootballMatches);
