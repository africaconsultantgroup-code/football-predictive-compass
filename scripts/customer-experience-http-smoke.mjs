import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const origin = new URL(process.env.CUSTOMER_EXPERIENCE_SMOKE_ORIGIN ?? "http://127.0.0.1:3102");
assert(["127.0.0.1", "localhost"].includes(origin.hostname), "This smoke runner is local-only.");
const results = [];
for (const path of ["/", "/matches", "/how-it-works", "/live", "/halftime", "/login", "/register", "/payments/paystack/callback"]) {
  const response = await fetch(new URL(path, origin), { redirect: "manual" });
  const html = await response.text();
  assert.equal(response.status, 200, path);
  assert(html.includes("site-shell matches-theme"), `${path}: shared customer design missing`);
  assert(!html.includes("bg-slate-950"), `${path}: legacy dark background`);
  results.push({ path, status: response.status, sharedTheme: true });
}
for (const path of ["/account", "/my-predictions"]) {
  const response = await fetch(new URL(path, origin), { redirect: "manual" });
  const html = await response.text();
  // App Router can stream a redirect after a 200 status. Both forms must send
  // the anonymous visitor to login, without rendering the protected page.
  assert(response.headers.get("location") === "/login" || /NEXT_REDIRECT|http-equiv="refresh"/.test(html), `${path}: authentication redirect missing`);
  assert(!html.includes('class="owned-card') && !html.includes('class="identity-panel'), `${path}: private page rendered`);
  results.push({ path, status: response.status, loginRedirect: true });
}
const premium = await fetch(new URL(`/api/football/matches/fm_${"a".repeat(32)}/premium`, origin));
assert.equal(premium.status, 401);
results.push({ path: "/api/football/matches/[matchId]/premium", status: premium.status });
writeFileSync(".staging/customer-experience/http-smoke.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify({ passed: results.length, results }));
