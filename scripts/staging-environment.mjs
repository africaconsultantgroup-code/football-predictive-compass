import { readFileSync, readdirSync } from "node:fs";
import { parseEnv } from "node:util";

export function validateStagingEnvironment(env) {
  if (env.PREDICTIVE_APP_ENV !== "staging") throw new Error("Explicit staging environment required.");
  const local = env.STAGING_INFRASTRUCTURE === "local";
  if (!local && env.STAGING_INFRASTRUCTURE !== "remote") throw new Error("Select local or remote staging infrastructure.");
  for (const [key, expected] of [
    ["NEXT_PUBLIC_SUPABASE_URL", local ? "http://127.0.0.1:55321" : env.STAGING_SUPABASE_ORIGIN],
    ["PREDICTIVE_COMPASS_CORE_URL", local ? "http://127.0.0.1:18000" : env.STAGING_CORE_ORIGIN],
  ]) {
    const url = new URL(env[key]);
    if (!expected || url.origin !== expected || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error(`Invalid staging origin: ${key}`);
    if (["sjmisufvuufgvimfswkk.supabase.co", "predictive-compass-ml-engine.vercel.app"].includes(url.hostname)) throw new Error(`Production endpoint forbidden: ${key}`);
    if (!local && url.protocol !== "https:") throw new Error(`Remote staging requires HTTPS: ${key}`);
  }
  for (const key of ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "PREDICTIVE_COMPASS_FOOTBALL_API_KEY"]) {
    if (!env[key]) throw new Error(`Missing staging configuration: ${key}`);
  }
  if (env.PAYSTACK_MODE !== "test") throw new Error("Staging requires PAYSTACK_MODE=test.");
  if (env.PAYSTACK_SECRET_KEY && !env.PAYSTACK_SECRET_KEY.startsWith("sk_test_")) throw new Error("Staging rejects live Paystack credentials.");
  if (env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY && !env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.startsWith("pk_test_")) throw new Error("Staging rejects live Paystack public keys.");
  const site = new URL(env.SITE_ORIGIN);
  if (site.origin !== env.SITE_ORIGIN || (local ? site.origin !== "http://127.0.0.1:3100" : site.protocol !== "https:")) throw new Error("Invalid staging SITE_ORIGIN.");
}

export function loadStagingEnvironment(root, filename = ".env.staging.local", inherited = process.env) {
  const env = { ...inherited };
  // Block Next's automatic .env.local fallback, including keys not yet known here.
  for (const file of readdirSync(root).filter((name) => /^\.env(?:\.|$)/.test(name))) {
    for (const key of Object.keys(parseEnv(readFileSync(`${root}/${file}`, "utf8")))) env[key] = "";
  }
  for (const key of Object.keys(env)) {
    if (/^(NEXT_PUBLIC_|SUPABASE_|PAYSTACK_|PREDICTIVE_|STAGING_|VERCEL_|SITE_ORIGIN$)/.test(key)) env[key] = "";
  }
  Object.assign(env, parseEnv(readFileSync(`${root}/${filename}`, "utf8")));
  validateStagingEnvironment(env);
  return env;
}
