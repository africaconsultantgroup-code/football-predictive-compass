import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadStagingEnvironment, validateStagingEnvironment } from "./staging-environment.mjs";

const safe = {
  PREDICTIVE_APP_ENV: "staging", STAGING_INFRASTRUCTURE: "local",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-public",
  SUPABASE_SECRET_KEY: "local-secret",
  PREDICTIVE_COMPASS_CORE_URL: "http://127.0.0.1:18000",
  PREDICTIVE_COMPASS_FOOTBALL_API_KEY: "local-engine",
  PAYSTACK_MODE: "test", SITE_ORIGIN: "http://127.0.0.1:3100",
};

describe("staging isolation", () => {
  it("allows auth testing without payment credentials", () => expect(() => validateStagingEnvironment(safe)).not.toThrow());
  it.each([
    { NEXT_PUBLIC_SUPABASE_URL: "https://sjmisufvuufgvimfswkk.supabase.co" },
    { PREDICTIVE_COMPASS_CORE_URL: "https://predictive-compass-ml-engine.vercel.app" },
    { PAYSTACK_MODE: "live", PAYSTACK_SECRET_KEY: "sk_live_example" },
    { PAYSTACK_SECRET_KEY: "sk_live_example" },
    { NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: "pk_live_example" },
    { PREDICTIVE_APP_ENV: "production" },
  ])("rejects unsafe overrides %j", (override) => expect(() => validateStagingEnvironment({ ...safe, ...override })).toThrow());
  it("clears inherited and Next auto-loaded production values", () => {
    const root = mkdtempSync(join(tmpdir(), "compass-staging-"));
    try {
      writeFileSync(join(root, ".env.local"), "PAYSTACK_SECRET_KEY=sk_live_old\nFUTURE_DATABASE_SECRET=production\n");
      writeFileSync(join(root, ".env.staging.local"), Object.entries(safe).map(([key, value]) => `${key}=${value}`).join("\n"));
      const env = loadStagingEnvironment(root, undefined, { PAYSTACK_SECRET_KEY: "sk_live_inherited", SUPABASE_SECRET_KEY: "production", PATH: "retained" });
      expect(env.PAYSTACK_SECRET_KEY).toBe("");
      expect(env.FUTURE_DATABASE_SECRET).toBe("");
      expect(env.SUPABASE_SECRET_KEY).toBe("local-secret");
      expect(env.PATH).toBe("retained");
    } finally { rmSync(root, { recursive: true }); }
  });
});
