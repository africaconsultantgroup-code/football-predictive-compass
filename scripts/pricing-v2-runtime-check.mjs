import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadStagingEnvironment } from "./staging-environment.mjs";
const env=loadStagingEnvironment(process.cwd());
if(env.STAGING_INFRASTRUCTURE!=="local")throw new Error("Runtime smoke requires isolated local staging");
const origin="http://127.0.0.1:3102";
const evidence={productionAccessed:false,realPayments:false,checks:[]};
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
for(const table of ["match_basket_quotes","match_basket_payments","customer_match_entitlements","match_checkout_reservations"]){
  const result=await admin.from(table).select("*",{head:true,count:"exact"});
  assert.equal(result.error,null,`Isolated staging table unavailable: ${table}; code=${result.error?.code??"none"}`);
  evidence.checks.push({table,accessible:true,count:result.count});
}
for(const [rpc,args,expected] of [
  ["accept_match_basket",{p_user:"ee000000-0000-4000-8000-000000000001",p_quote:"ee100000-0000-4000-8000-000000000001",p_payment:"ee200000-0000-4000-8000-000000000001",p_reference:"read-only-unavailable-quote"},"QUOTE_NOT_FOUND"],
  ["finish_match_basket",{p_payment:"ee200000-0000-4000-8000-000000000001",p_status:"pending",p_paid_at:null},"PAYMENT_NOT_FOUND"],
]){
  const result=await admin.rpc(rpc,args); assert.equal(result.error?.code,"P0001",`Staging RPC unavailable: ${rpc}`); assert.ok(result.error?.message.includes(expected));
  evidence.checks.push({rpc,reachable:true,missingResourceRejected:true,writes:0});
}
const matches=await fetch(`${origin}/matches?competition=all`),html=await matches.text();
assert.equal(matches.status,200); assert.match(html,/Your Match Selection/); assert.doesNotMatch(html,/Matchday Pass|GHS 25/);
evidence.checks.push({path:"/matches?competition=all",status:matches.status,basketVisible:true,legacyPassAbsent:true});
const how=await fetch(`${origin}/how-it-works`),howHtml=await how.text(); assert.equal(how.status,200);
for(const value of ["GH₵8","GH₵15","GH₵21","GH₵27","GH₵33","GH₵39","GH₵45","GH₵51","GH₵57","GH₵63"])assert.ok(howHtml.includes(value));
evidence.checks.push({path:"/how-it-works",status:how.status,allTenApprovedTotalsVisible:true});
for(const [path,body] of [["/api/payments/matches/quote",{match_ids:[]}],["/api/payments/paystack/initialize",{quote_id:"ee100000-0000-4000-8000-000000000001"}]]){
  const response=await fetch(origin+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); assert.equal(response.status,401);
  evidence.checks.push({path,status:response.status});
}
const premium=await fetch(`${origin}/api/football/matches/fm_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/premium`);assert.equal(premium.status,401);
evidence.checks.push({path:"/api/football/matches/[matchId]/premium",status:premium.status});
// Read existing staging inventory only; no freshness POST/worker/provider calls.
const from=new Date(),to=new Date(from);to.setUTCDate(to.getUTCDate()+4);
const parameters=new URLSearchParams({from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)});
for(const path of ["api/v1/domains/football/predictions/upcoming","api/v1/domains/football/free/upcoming"]){
  const response=await fetch(new URL(`${path}?${parameters}`,env.PREDICTIVE_COMPASS_CORE_URL),{headers:{"x-api-key":env.PREDICTIVE_COMPASS_FOOTBALL_API_KEY},signal:AbortSignal.timeout(8000)});
  const body=await response.json().catch(()=>null);
  const records=Array.isArray(body)?body:Array.isArray(body?.predictions)?body.predictions:[];
  evidence.checks.push({stagingCorePath:path,status:response.status,storedUpcomingRecords:response.ok?records.length:null});
}
mkdirSync("output/pricing-v2",{recursive:true});writeFileSync("output/pricing-v2/runtime-results.json",JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify(evidence,null,2));
