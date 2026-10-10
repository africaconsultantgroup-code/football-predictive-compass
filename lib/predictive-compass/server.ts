import "server-only";
import { freePrematchSchema } from "./free";
import { normalizeFixtureTeamMetadata } from "../teams/identity";
import { toPremiumCustomerPrediction } from "./premium";

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
import { matchPricingV2Enabled } from "../payments/pricing-version";

const DEFAULT_TIMEOUT_MS = 8_000;
const INVENTORY_TIMEOUT_MS = 20_000;

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
  inventoryTimeoutMs?: number;
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
  inventoryTimeoutMs = timeoutMs === DEFAULT_TIMEOUT_MS ? INVENTORY_TIMEOUT_MS : timeoutMs,
}: CoreClientOptions) {
  const request = async (path: string, method: "GET" | "POST" = "GET", allowNotFound = false, deadlineMs = timeoutMs) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), deadlineMs);

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

      if (allowNotFound && response.status === 404) return null;
      if (!response.ok) {
        throw new CoreClientError(mapStatus(response.status));
      }

      return normalizeFixtureTeamMetadata(await parseJson(response));
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

  // One bounded retry for read-only inventory transport failures. Never retry
  // authentication, invalid DTOs or the freshness POST; never cache failures.
  const inventoryRequest = async (path: string, allowNotFound = false) => {
    try { return await request(path, "GET", allowNotFound, inventoryTimeoutMs); }
    catch (error) {
      if (!(error instanceof CoreClientError) || !["timeout", "unavailable"].includes(error.kind)) throw error;
      return request(path, "GET", allowNotFound, inventoryTimeoutMs);
    }
  };

  return {
    async getPremiumFootballPrediction(predictionId: string, matchId: string) {
      try {
        const value = await request(`api/v1/domains/football/predictions/${encodeURIComponent(predictionId)}`);
        const prediction = toPremiumCustomerPrediction(value);
        if (!value || typeof value !== "object" || !("prediction_id" in value) || value.prediction_id !== predictionId || prediction.match_id !== matchId) throw new CoreClientError("malformed");
        return prediction;
      } catch (error) {
        if (error instanceof CoreClientError) throw error;
        throw new CoreClientError("malformed");
      }
    },
    async getStoredFreePrematch(matchId: string) {
      const id = footballMatchIdSchema.parse(matchId);
      const value = await request(`api/v1/domains/football/matches/${id}/free`, "GET", true);
      if (value === null) return null;
      const free = freePrematchSchema.parse(value);
      if (free.match_id !== id) throw new CoreClientError("malformed");
      return free;
    },
    async getStoredFreeUpcoming() {
      const start = new Date();
      const end = new Date(start); end.setUTCDate(end.getUTCDate()+4);
      const query = new URLSearchParams({ from: start.toISOString().slice(0,10), to: end.toISOString().slice(0,10) });
      const value = await inventoryRequest(`api/v1/domains/football/free/upcoming?${query}`, true);
      if (value === null) return [];
      if (!value || typeof value !== "object" || !("predictions" in value) || !Array.isArray(value.predictions)) throw new CoreClientError("malformed");
      const predictions: unknown[] = value.predictions;
      return predictions.map(item => freePrematchSchema.parse(item));
    },
    async getUpcomingFootballPredictions({ syncProducts = true }: { syncProducts?: boolean } = {}) {
      try {
        const start = new Date();
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 4);
        const parameters = new URLSearchParams({
          from: start.toISOString().slice(0, 10),
          to: end.toISOString().slice(0, 10),
        });
        const predictions = parseUpcomingFootballPredictions(
          await inventoryRequest(
            `api/v1/domains/football/predictions/upcoming?${parameters}`,
          ),
        );
        if (syncProducts && !matchPricingV2Enabled()) await syncUpcomingPredictionProducts(predictions).catch(() => undefined);
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
        if (!matchPricingV2Enabled()) await syncLivePredictionProducts(matches.matches).catch(() => undefined);
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

export async function getStoredFreePrematch(matchId: string) {
  return getConfiguredClient().getStoredFreePrematch(matchId);
}
export async function getStoredFreeUpcoming() {
  return getConfiguredClient().getStoredFreeUpcoming();
}

export async function getUpcomingFootballPredictions(options?: { syncProducts?: boolean }) {
  return getConfiguredClient().getUpcomingFootballPredictions(options);
}

export async function getFootballPrediction(predictionId: string) {
  return getConfiguredClient().getFootballPrediction(predictionId);
}

export async function getPremiumFootballPrediction(predictionId: string, matchId: string) {
  return getConfiguredClient().getPremiumFootballPrediction(predictionId, matchId);
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
