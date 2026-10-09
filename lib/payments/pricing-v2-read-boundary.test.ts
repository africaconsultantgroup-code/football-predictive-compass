import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks=vi.hoisted(()=>({upcoming:vi.fn(),live:vi.fn()}));
vi.mock("./product-sync",()=>({syncUpcomingPredictionProducts:mocks.upcoming,syncLivePredictionProducts:mocks.live}));
import { createFootballCoreClient } from "../predictive-compass/server";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
describe("V2 customer reads remain independent from legacy stage pricing",()=>{
  it("reads stored predictions and live state without generating forecasts or creating stage products",async()=>{
    vi.stubEnv("PREDICTIVE_CUSTOMER_PRICING_VERSION","v2");
    const fetch=vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(new Response(JSON.stringify({predictions:[]}))).mockResolvedValueOnce(new Response(JSON.stringify({domain:"football",matches:[]})));
    const core=createFootballCoreClient({baseUrl:"https://core.example.test",apiKey:"unit-test-only",fetch});
    await core.getUpcomingFootballPredictions();await core.getLiveFootballMatches();
    expect(mocks.upcoming).not.toHaveBeenCalled();expect(mocks.live).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(2);
    for(const [,options] of fetch.mock.calls)expect(options?.method).toBe("GET");
  });
});
