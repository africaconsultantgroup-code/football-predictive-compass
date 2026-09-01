import "server-only";

import { footballPredictionSchema, parseUpcomingFootballPredictions } from "./schema";

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
  const request = async (path: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImplementation(new URL(path, `${baseUrl.replace(/\/$/, "")}/`), {
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
        return parseUpcomingFootballPredictions(
          await request(
            `api/v1/domains/football/predictions/upcoming?${parameters}`,
          ),
        );
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
