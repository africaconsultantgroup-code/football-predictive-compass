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
  preview: (value: unknown, access: CustomerAccess) => unknown | Promise<unknown>,
) {
  return async function GET() {
    try {
      const [value, access] = await Promise.all([load(), loadAccess()]);
      return Response.json(
        accessHasCapability(access, capability) ? value : await preview(value, access),
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
  transform?: (value: unknown, access: CustomerAccess) => Promise<unknown | null>,
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
      const value = await load(parsed.data);
      if (!accessHasCapability(access, capability) && !transform) {
        return Response.json({ error: "Full access required." }, {
          status: 403,
          headers: responseHeaders,
        });
      }
      if (accessHasCapability(access, capability)) {
        return Response.json(value, { headers: responseHeaders });
      }
      const transformed = await transform!(value, access);
      if (transformed === null) {
        return Response.json({ error: "Prediction access required." }, { status: 403, headers: responseHeaders });
      }
      return Response.json(transformed, { headers: responseHeaders });
    } catch {
      return Response.json(unavailableBody, {
        status: 503,
        headers: responseHeaders,
      });
    }
  };
}
