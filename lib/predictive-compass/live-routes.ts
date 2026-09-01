import { footballMatchIdSchema } from "./schema";

const unavailableBody = {
  error: "Live football data is temporarily unavailable.",
};

const responseHeaders = { "Cache-Control": "no-store" };

export function createLiveListHandler(
  load: () => Promise<unknown>,
) {
  return async function GET() {
    try {
      return Response.json(await load(), { headers: responseHeaders });
    } catch {
      return Response.json(unavailableBody, {
        status: 503,
        headers: responseHeaders,
      });
    }
  };
}
export function createLiveMatchHandler(
  load: (matchId: string) => Promise<unknown>,
) {
  return async function GET(matchId: string) {
    const parsed = footballMatchIdSchema.safeParse(matchId);
    if (!parsed.success) {
      return Response.json({ error: "Invalid match identifier." }, {
        status: 400,
        headers: responseHeaders,
      });
    }

    try {
      return Response.json(await load(parsed.data), { headers: responseHeaders });
    } catch {
      return Response.json(unavailableBody, {
        status: 503,
        headers: responseHeaders,
      });
    }
  };
}
