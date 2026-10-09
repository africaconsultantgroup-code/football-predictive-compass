import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only",()=>({}));
import { initializePredictionPayment } from "./service";
import { createPaystackClient } from "./paystack";
afterEach(()=>vi.unstubAllEnvs());
it("retires every legacy product initializer when V2 is active, before DB lookup or provider call",async()=>{
  vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION","v2");
  const from=vi.fn(),initialize=vi.fn();
  const result=await initializePredictionPayment({admin:{from} as unknown as SupabaseClient,paystack:{initialize} as unknown as ReturnType<typeof createPaystackClient>,userId:"user",email:"unit@example.invalid",productId:"legacy",callbackOrigin:"https://customer.example",hasExistingAccess:async()=>false,lifecycleAllows:async()=>true});
  expect(result).toEqual({error:"LEGACY_PRICING_RETIRED"});
  expect(from).not.toHaveBeenCalled(); expect(initialize).not.toHaveBeenCalled();
});
