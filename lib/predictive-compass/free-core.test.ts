import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createFootballCoreClient } from "./server";
import { createFreePrematchHandler } from "./free";

const id = `fm_${"a".repeat(32)}`;
const free = { match_id: id, competition: "Premier League", home_team: "Home", away_team: "Away", kickoff_at: "2026-10-10T14:00:00Z", stage: "PREMATCH", tier: "free", status: "available", probabilities: { home_win: 45, draw: 30, away_win: 25 }, predicted_outcome: "home_win", generated_at: "2026-10-08T10:00:00Z" };

function client(body: unknown, status = 200) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }));
  return { fetchMock, core: createFootballCoreClient({ baseUrl: "https://engine.example.test", apiKey: "service-secret", fetch: fetchMock }) };
}

describe("Dedicated stored FREE source transport", () => {
  it("uses the dedicated GET with server authentication and exposes only free data publicly", async () => {
    const { core, fetchMock } = client(free);
    const response = await createFreePrematchHandler(id => core.getStoredFreePrematch(id))(id);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(free);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`/matches/${id}/free`);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("service-secret");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", headers: { "x-api-key": "service-secret" } });
  });
  it("reads the stored free list without reading premium", async () => {
    const { core, fetchMock } = client({ predictions: [free] });
    expect(await core.getStoredFreeUpcoming()).toEqual([free]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/free/upcoming?");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("treats a missing stored free snapshot as missing, without fallback to another engine", async () => {
    const { core, fetchMock } = client({}, 404);
    expect(await core.getStoredFreePrematch(id)).toBeNull();
    expect(await core.getStoredFreeUpcoming()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(call => String(call[0]).includes("/free"))).toBe(true);
  });
  it.each(["combined", "shadow_probabilities", "model_version", "policy", "input_results"])("rejects leaked internal field %s from the source", async key => {
    const { core } = client({ ...free, [key]: "private" });
    expect((await createFreePrematchHandler(id => core.getStoredFreePrematch(id))(id)).status).toBe(503);
  });
  it("rejects a source response with a different match identity", async () => {
    const { core } = client({ ...free, match_id: `fm_${"b".repeat(32)}` });
    await expect(core.getStoredFreePrematch(id)).rejects.toThrow();
  });
});
