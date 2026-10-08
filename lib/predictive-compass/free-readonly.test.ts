import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { sync } = vi.hoisted(() => ({ sync: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../payments/product-sync", () => ({ syncUpcomingPredictionProducts: sync, syncLivePredictionProducts: vi.fn() }));
import { createFootballCoreClient } from "./server";

describe("Free fixture metadata read", () => {
  it("performs only GET and skips product writes while preserving the existing premium default", async () => {
    sync.mockClear();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ predictions: [] }));
    const client = createFootballCoreClient({ baseUrl: "https://example.test", apiKey: "test", fetch: fetchMock });
    await client.getUpcomingFootballPredictions({ syncProducts: false });
    expect(sync).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1]?.method).toBe("GET");
    await client.getUpcomingFootballPredictions();
    expect(sync).toHaveBeenCalledExactlyOnceWith([]);
  });
});
