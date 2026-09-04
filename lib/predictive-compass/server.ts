import "server-only";

import {
  footballLiveMatchListSchema,
  footballMatchIdSchema,
  footballMatchPredictionSchema,
  footballPrematchFreshnessSchema,
  footballPredictionHistorySchema,
  footballPredictionSchema,
  parseUpcomingFootballPredictions,
} from "./schema";
import { syncLivePredictionProducts, syncUpcomingPredictionProducts } from "../payments/product-sync";

const DEFAULT_TIMEOUT_MS = 8_000;

export type CoreClientErrorKind =
  | "configuration"
  | "unauthorized"
  | "forbidden"
  | "timeout"
  | "unavailable"
  | "malformed";

export class CoreClientError extends Error {
  constructor(public readonly kind: CoreClientErrorKind) {
    super(`Predictive Compass Core request failed: ${kind}`);
    this.name = "CoreClientError";
  }
}

type CoreClientOptions = {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

function mapStatus(status: number): CoreClientErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  return "unavailable";
}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new CoreClientError("malformed");
  }
}

export function createFootballCoreClient({
  baseUrl,
  apiKey,
  fetch: fetchImplementation = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: CoreClientOptions) {
  const request = async (path: string, method: "GET" | "POST" = "GET") => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImplementation(new URL(path, `${baseUrl.replace(/\/$/, "")}/`), {
        method,
        headers: {
          Accept: "application/json",
          "x-api-key": apiKey,
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new CoreClientError(mapStatus(response.status));
      }

      return await parseJson(response);
    } catch (error) {
      if (error instanceof CoreClientError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new CoreClientError("timeout");
      }
      throw new CoreClientError("unavailable");
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    async getUpcomingFootballPredictions() {
      try {
        const start = new Date();
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 4);
        const parameters = new URLSearchParams({
          from: start.toISOString().slice(0, 10),
          to: end.toISOString().slice(0, 10),
        });
        const predictions = parseUpcomingFootballPredictions(
          await request(
            `api/v1/domains/football/predictions/upcoming?${parameters}`,
          ),
        );
        await syncUpcomingPredictionProducts(predictions).catch(() => undefined);
        return predictions;
      } catch (error) {
        if (error instanceof CoreClientError) throw error;
        throw new CoreClientError("malformed");
      }
    },

    async getFootballPrediction(predictionId: string) {
      try {
        return footballPredictionSchema.parse(
          await request(
            `api/v1/domains/football/predictions/${encodeURIComponent(predictionId)}`,
          ),
        );
      } catch (error) {
        if (error instanceof CoreClientError) throw error;
        throw new CoreClientError("malformed");
      }
    },

    async requestPrematchFreshness(matchId: string) {
      const validMatchId = footballMatchIdSchema.safeParse(matchId);
      if (!validMatchId.success) throw new CoreClientError("malformed");
      try {
        return footballPrematchFreshnessSchema.parse(
          await request(
            `api/v1/domains/football/matches/${encodeURIComponent(validMatchId.data)}/prematch/freshness`,
            "POST",
          ),
        );
      } catch (error) {
        if (error instanceof CoreClientError) throw error;
        throw new CoreClientError("malformed");
      }
    },

    async getLiveFootballMatches() {
      try {
        const matches = footballLiveMatchListSchema.parse(
          await request("api/v1/domains/football/matches/live"),
        );
        await syncLivePredictionProducts(matches.matches).catch(() => undefined);
        return matches;
      } catch (error) {
        if (error instanceof CoreClientError) throw error;
        throw new CoreClientError("malformed");
      }
    },

    async getLiveFootballPrediction(matchId: string) {
      const validMatchId = footballMatchIdSchema.safeParse(matchId);
      if (!validMatchId.success) throw new CoreClientError("malformed");
      try {
        return footballMatchPredictionSchema.parse(
          await request(
            `api/v1/domains/football/matches/${encodeURIComponent(validMatchId.data)}/prediction`,
          ),
        );
      } catch (error) {
        if (error instanceof CoreClientError) throw error;
        throw new CoreClientError("malformed");
      }
    },

    async getLiveFootballPredictionHistory(matchId: string) {
      const validMatchId = footballMatchIdSchema.safeParse(matchId);
      if (!validMatchId.success) throw new CoreClientError("malformed");
      try {
        return footballPredictionHistorySchema.parse(
          await request(
            `api/v1/domains/football/matches/${encodeURIComponent(validMatchId.data)}/prediction/history`,
          ),
        );
      } catch (error) {
        if (error instanceof CoreClientError) throw error;
        throw new CoreClientError("malformed");
      }
    },
  };
}

function getConfiguredClient() {
  const baseUrl = process.env.PREDICTIVE_COMPASS_CORE_URL;
  const apiKey = process.env.PREDICTIVE_COMPASS_FOOTBALL_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new CoreClientError("configuration");
  }

  return createFootballCoreClient({ baseUrl, apiKey });
}

export async function getUpcomingFootballPredictions() {
  return getConfiguredClient().getUpcomingFootballPredictions();
}

export async function getFootballPrediction(predictionId: string) {
  return getConfiguredClient().getFootballPrediction(predictionId);
}

export async function requestPrematchFreshness(matchId: string) {
  return getConfiguredClient().requestPrematchFreshness(matchId);
}

export async function getLiveFootballMatches() {
  return getConfiguredClient().getLiveFootballMatches();
}

export async function getLiveFootballPrediction(matchId: string) {
  return getConfiguredClient().getLiveFootballPrediction(matchId);
}

export async function getLiveFootballPredictionHistory(matchId: string) {
  return getConfiguredClient().getLiveFootballPredictionHistory(matchId);
}
