import { readFileSync, existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/matches", useRouter: () => ({ push: vi.fn() }) }));
const mocks = vi.hoisted(() => ({ premium: vi.fn(), free: vi.fn(), access: vi.fn(), client: vi.fn(), allowed: vi.fn() }));
vi.mock("../lib/predictive-compass/server", () => ({ getUpcomingFootballPredictions: mocks.premium, getStoredFreeUpcoming: mocks.free }));
vi.mock("../lib/auth/access", () => ({ getCustomerAccess: mocks.access }));
vi.mock("../lib/auth/match-access", () => ({ hasPredictionAccess: mocks.allowed }));
vi.mock("../lib/supabase/auth-server", () => ({ createCustomerAuthServerClient: mocks.client }));
import { loadPredictions, filterPredictionViews } from "./predictions";
import { MatchesDashboard } from "./matches/dashboard";
import { TeamIdentity } from "./team-identity";
import { CustomerShell } from "./customer-shell";
import { customerFixture, fixtureTitle } from "../lib/predictive-compass/fixture";
import { footballPredictionSchema } from "../lib/predictive-compass/schema";
import { freePrematchSchema } from "../lib/predictive-compass/free";
import { FreeOnlyMatchRow, MatchRow } from "./matches/match-components";
import { toPredictionPreview } from "../lib/predictive-compass/preview";

const identity = { match_id: `fm_${"a".repeat(32)}`, home_team: "Arsenal", away_team: "Chelsea", competition: "Premier League", kickoff_at: "2026-10-12T15:00:00Z", stage: "PREMATCH" as const };
const premium = footballPredictionSchema.parse({ ...identity, prediction_id: "private-prediction", predicted_outcome: "home_win", predicted_score: null, probabilities: { home_win: 58, draw: 25, away_win: 17 }, reliability: { score: 70, label: "High" }, verification_status: "verified", important_information_pending: false, customer_summary: "Private paid summary", customer_key_factors: [], generated_at: null, updated_at: null });
const free = freePrematchSchema.parse({ ...identity, tier: "free", status: "available", probabilities: { home_win: 45, draw: 30, away_win: 25 }, predicted_outcome: "home_win", generated_at: "2026-10-09T10:00:00Z" });
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-09T11:00:00Z")); mocks.premium.mockResolvedValue([premium]); mocks.free.mockResolvedValue([free]); mocks.access.mockResolvedValue({ customer: null }); mocks.client.mockResolvedValue({}); mocks.allowed.mockResolvedValue(false); });
afterEach(() => vi.useRealTimers());

describe("customer inventory degradation", () => {
  it("retains fixture identity and withholds paid data when access infrastructure fails", async () => {
    mocks.access.mockRejectedValue(new Error("private infrastructure error"));
    const result = await loadPredictions();
    expect(result.failed).toBe(false); expect(result.predictions).toHaveLength(1);
    expect(result.predictions[0]).toHaveProperty("locked", true);
    expect(JSON.stringify(result)).not.toContain("probabilities");
    expect(JSON.stringify(result)).not.toContain("Private paid summary");
  });
  it("fails closed for one broken entitlement lookup without erasing the inventory", async () => {
    mocks.allowed.mockRejectedValue(new Error("access failure"));
    expect((await loadPredictions()).predictions[0]).toHaveProperty("locked", true);
  });
  it("renders genuine available Free identity when Premium transport fails", async () => {
    mocks.premium.mockRejectedValue({ kind: "timeout" });
    const html = renderToStaticMarkup(await MatchesDashboard({ filter: "all" }));
    expect(html).toContain("Arsenal"); expect(html).toContain("45%");
    expect(html).toContain("Premium intelligence being prepared");
    expect(html).not.toContain("58%"); expect(html).not.toContain("No upcoming matches");
  });
  it("does not retain a negative inventory result across the next request", async () => {
    mocks.premium.mockRejectedValueOnce({ kind: "timeout" });
    expect((await loadPredictions()).diagnostic).toBe("CORE_TIMEOUT");
    expect((await loadPredictions()).predictions).toHaveLength(1);
  });
  it.each([["timeout", "CORE_TIMEOUT"], ["malformed", "DTO_PARSE_FAILED"], ["unauthorized", "CORE_REQUEST_FAILED"]])("distinguishes %s from a legitimate empty schedule", async (kind, expected) => {
    mocks.premium.mockRejectedValue({ kind }); expect((await loadPredictions()).diagnostic).toBe(expected);
  });
  it("separates upstream failure, empty schedule and filtered-to-zero copy", async () => {
    mocks.premium.mockResolvedValue([]); mocks.free.mockResolvedValue([]);
    expect(renderToStaticMarkup(await MatchesDashboard({ filter: "all" }))).toContain("No upcoming matches currently available");
    mocks.free.mockRejectedValue({ kind: "timeout" });
    expect(renderToStaticMarkup(await MatchesDashboard({ filter: "all" }))).toContain("Match service temporarily unavailable");
    mocks.free.mockResolvedValue([free]);
    expect(renderToStaticMarkup(await MatchesDashboard({ filter: "all", competition: "UEFA Champions League" }))).toContain("No matches in this view");
  });
  it("joins matching identities once and defaults to both supported competitions", async () => {
    mocks.free.mockResolvedValue([free, { ...free, match_id: `fm_${"b".repeat(32)}`, competition: "UEFA Champions League", home_team: "Lens", away_team: "Sporting CP" }]);
    const html = renderToStaticMarkup(await MatchesDashboard({ filter: "all" }));
    expect(html).toContain("2 matches"); expect(html).toContain("Lens"); expect(html).toContain("Chelsea");
    expect(html).not.toContain("58%");
  });
});

describe("customer fixture identity and shared design", () => {
  it("normalizes known competition aliases before filtering", () => {
    expect(filterPredictionViews([{ ...identity, competition: "EPL" }], "all", "Premier League")).toHaveLength(1);
    expect(filterPredictionViews([{ ...identity, competition: "UCL" }], "all", "UEFA Champions League")).toHaveLength(1);
  });
  it("projects explicit display fields without spreading Premium/internal objects", () => {
    const dto = customerFixture({ ...premium, shadow: "secret", world_state: "secret" } as typeof premium, { freeAvailable: true, premiumAvailable: true, owned: false }, { home: { crest: "https://provider.example/crest.png", shortName: "ARS" } });
    expect(dto.homeTeamLogo).toBe("https://provider.example/crest.png"); expect(dto.homeTeamShortName).toBe("ARS"); expect(dto.competitionCode).toBe("EPL");
    expect(dto.basketEligible).toBe(true); expect(JSON.stringify(dto)).not.toMatch(/secret|probabilities|shadow|world_state|prediction_id/);
  });
  it("renders a supplied crest and initials when absent, without inventing URLs", () => {
    expect(renderToStaticMarkup(<TeamIdentity name="Arsenal" crest="https://provider.example/crest.png" />)).toContain('src="https://provider.example/crest.png"');
    const fallback = renderToStaticMarkup(<TeamIdentity name="Sporting CP" />);
    expect(fallback).toContain(">SC<"); expect(fallback).not.toContain("<img");
    expect(renderToStaticMarkup(<TeamIdentity name="Lens" crest="javascript:alert(1)" />)).not.toContain("<img");
  });
  it("never uses an internal ID as a missing identity title", () => {
    expect(fixtureTitle()).toBe("Match details being prepared");
    const page = readFileSync("app/my-predictions/page.tsx", "utf8");
    expect(page).not.toContain(":match.matchId}"); expect(page).toContain("fixtureTitle(match.homeTeam, match.awayTeam)");
  });
  it("uses the identical white-blue shell, logo and active navigation on every customer page", () => {
    const html = renderToStaticMarkup(<CustomerShell authenticated={false}><h1>Account</h1></CustomerShell>);
    expect(html).toContain("site-shell matches-theme"); expect(html).toContain("Predictive Compass");
    expect(html).toContain('aria-current="page" href="/matches"'); expect(html).not.toContain('href="/" aria-current');
    for (const page of ["app/page.tsx", "app/account/page.tsx", "app/how-it-works/page.tsx", "app/live/page.tsx", "app/halftime/page.tsx", "app/my-predictions/page.tsx", "app/auth-shell.tsx", "app/payments/paystack/callback/page.tsx"]) expect(readFileSync(page,"utf8")).toContain("CustomerShell");
  });
  it("current purchase surfaces no longer render old stage/pass prices", () => {
    for (const page of ["app/matches/dashboard.tsx", "app/matches/match-components.tsx", "app/matches/free-detail.tsx", "app/how-it-works/page.tsx", "app/live-matches.tsx"]) expect(readFileSync(page,"utf8")).not.toMatch(/PREVIEW_PRICING|<MatchdayPass|<PremiumOption|<CheckoutButton|getActiveMatchPricingRules/);
  });
});

// Actual read-only Core capture, kept in ignored local evidence. This explicitly
// runs when evidence is available; CI never needs production credentials.
const capturePath = ".staging/customer-experience/core-responses.json";
describe.skipIf(!existsSync(capturePath))("actual current Core adapter evidence", () => {
  it("transforms genuine EPL and UCL feeds into safe cards", () => {
    const capture = JSON.parse(readFileSync(capturePath, "utf8"));
    const premiums = capture.feeds.premium.body.predictions.map((value: unknown) => footballPredictionSchema.parse(value));
    const frees = capture.feeds.free.body.predictions.map((value: unknown) => freePrematchSchema.parse(value));
    for (const competition of ["Premier League", "UEFA Champions League"]) {
      const fixture = frees.find((item: typeof free) => item.competition === competition);
      expect(fixture).toBeDefined(); expect(fixture.kickoff_at).toBeTruthy();
      const paid = premiums.find((item: typeof premium) => item.match_id === fixture.match_id);
      const card = renderToStaticMarkup(paid ? <MatchRow prediction={toPredictionPreview(paid, [])} freePrediction={fixture} /> : <FreeOnlyMatchRow free={fixture} />);
      expect(card).toContain(fixture.home_team); expect(card).toContain(fixture.away_team); expect(card).toContain(competition);
      expect(card).toContain("FREE PRE-MATCH"); expect(card).toContain("Premium Match Intelligence");
      expect(card).not.toMatch(/shadow|experiment|world_state|policy_version|research_diagnostic/);
    }
    expect(frees).toHaveLength(19); expect(premiums).toHaveLength(10);
  });
});
