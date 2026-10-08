import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { PremiumMatchExperience } from "./premium-components";
import { premiumIntelligenceFixture } from "../../lib/predictive-compass/premium.fixture";

it("provides a labelled responsive contract fixture using actual Premium components and CSS", () => {
  const premiumCss = readFileSync(resolve("app/matches/premium.css"), "utf8");
  expect(premiumCss).toContain("min-width:0");
  expect(premiumCss).toContain("grid-template-columns:1fr");
  expect(premiumCss).not.toContain("order:-");
  const prediction = { match_id: `fm_${"a".repeat(32)}`, competition: "Premier League", home_team: "Home FC", away_team: "Away FC", kickoff_at: "2026-10-10T14:00:00Z", stage: "PREMATCH" as const, tier: "premium" as const, status: "available" as const, premium_intelligence: premiumIntelligenceFixture };
  const markup = renderToStaticMarkup(<PremiumMatchExperience prediction={prediction} free={null} now={new Date("2026-10-09T12:00:00Z")} />);
  const css = readFileSync(resolve("app/matches/dashboard.css"), "utf8") + premiumCss;
  mkdirSync(resolve("output/premium-contract"), { recursive: true });
  writeFileSync(resolve("output/premium-contract/layout.html"), `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Premium contract layout fixture</title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#f8fbff;padding:16px}h1{font-size:24px}${css}</style></head><body class="matches-theme"><p>ILLUSTRATIVE CONTRACT TEST FIXTURE — not a real match forecast</p><h1>Home FC vs Away FC</h1>${markup}</body></html>`);
});
