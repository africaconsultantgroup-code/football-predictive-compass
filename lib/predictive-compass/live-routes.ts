import { footballMatchIdSchema } from "./schema";
import type { CustomerAccess, CustomerCapability } from "../auth/access";
import { accessHasCapability } from "../auth/access";

const unavailableBody = {
  error: "Live football data is temporarily unavailable.",
};

const responseHeaders = { "Cache-Control": "no-store" };

export function createLiveListHandler(
  load: () => Promise<unknown>,
  loadAccess: () => Promise<CustomerAccess>,
  capability: CustomerCapability,
  preview: (value: unknown) => unknown,
) {
  return async function GET() {
    try {
      const [value, access] = await Promise.all([load(), loadAccess()]);
      return Response.json(
        accessHasCapability(access, capability) ? value : preview(value),
        { headers: responseHeaders },
      );
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
  loadAccess: () => Promise<CustomerAccess>,
  capability: CustomerCapability,
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
      const access = await loadAccess();
      if (!access.customer) {
        return Response.json({ error: "Authentication required." }, {
          status: 401,
          headers: responseHeaders,
        });
      }
      if (!accessHasCapability(access, capability)) {
        return Response.json({ error: "Full access required." }, {
          status: 403,
          headers: responseHeaders,
        });
      }
      return Response.json(await load(parsed.data), { headers: responseHeaders });
    } catch {
      return Response.json(unavailableBody, {
        status: 503,
        headers: responseHeaders,
      });
    }
  };
}
