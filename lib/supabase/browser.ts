import { createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseConfig } from "./config";

export function createCustomerBrowserClient() {
  const { url, publishableKey } = getPublicSupabaseConfig();
  return createBrowserClient(url, publishableKey);
}
