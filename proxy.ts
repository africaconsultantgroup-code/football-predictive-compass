import type { NextRequest } from "next/server";

import { refreshCustomerSession } from "./lib/supabase/auth-proxy";

export async function proxy(request: NextRequest) {
  return refreshCustomerSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
