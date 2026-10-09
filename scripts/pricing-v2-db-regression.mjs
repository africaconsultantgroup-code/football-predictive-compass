import { spawn } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

// Deliberately no connection-string/env option: this cannot target production.
const container = "supabase_db_predictive-compass-customer-staging";
const schema = `pricing_v2_test_${Date.now()}`;
if (!/^pricing_v2_test_\d+$/.test(schema)) throw new Error("Invalid isolated test schema");
function query(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"], { stdio:["pipe","pipe","pipe"] });
    let output="", error="";
    child.stdout.on("data", value=>{output+=value;}); child.stderr.on("data", value=>{error+=value;});
    child.on("error",reject); child.on("exit",code=>resolve({code,output,error})); child.stdin.end(sql);
  });
}
function success(result) { assert.equal(result.code,0,result.error); return result.output; }
const suite = success(await query(readFileSync("supabase/tests/customer_match_pricing_v2.sql","utf8")));
assert.doesNotMatch(suite,/not ok|Looks like you/i);
const databaseAssertions=(suite.match(/^ok \d+/gm)||[]).length;
assert.match(suite,new RegExp(`1\\.\\.${databaseAssertions}(?:\\r?\\n)`));
const migration=readFileSync("supabase/migrations/20261008150122_customer_match_pricing_v2.sql","utf8");
const corrected=readFileSync("supabase/migrations/20261008205000_customer_match_pricing_v2_ghs8.sql","utf8");
const accept=corrected.match(/create or replace function public\.accept_match_basket[\s\S]*?end \$\$;/)[0].replaceAll("public.",`${schema}.`);
const finish=migration.match(/create function public\.finish_match_basket[\s\S]*?end \$\$;/)[0].replaceAll("public.",`${schema}.`);
const user="dd000000-0000-4000-8000-000000000001";
const q1="dd100000-0000-4000-8000-000000000001",q2="dd100000-0000-4000-8000-000000000002";
const p1="dd200000-0000-4000-8000-000000000001",p2="dd200000-0000-4000-8000-000000000002";
const hashSql="select md5(coalesce(string_agg(to_jsonb(p)::text,'|' order by public_prediction_id),'')) from public.public_predictions p;";
const hashBefore=success(await query(hashSql)).trim();
try {
  success(await query(`create schema ${schema}; ${["match_basket_quotes","match_basket_payments","customer_match_entitlements","match_checkout_reservations","prediction_payments","prediction_access_product_matches"].map(table=>`create table ${schema}.${table} (like public.${table} including all);`).join("\n")} ${accept} ${finish}
    insert into ${schema}.match_basket_quotes(id,user_id,policy_version,currency,ghana_date,fixtures,match_count,tier,unit_pesewas,regular_pesewas,discount_pesewas,total_pesewas,expires_at)
    select q::uuid,'${user}','daily-match-v2-ghs8','GHS',current_date+1,
      '[{"match_id":"fm_dd000000000000000000000000000001","kickoff_at":"2030-01-01T18:00:00Z"}]'::jsonb,1,1,800,800,0,800,now()+interval '10 minutes'
    from unnest(array['${q1}','${q2}']) q;`));
  const first=query(`begin; select (${schema}.accept_match_basket('${user}','${q1}','${p1}','concurrency-first')).id; select pg_sleep(1.5); commit;`);
  // Wait until the first connection actually holds the reservation, rather than
  // guessing process launch time. Its advisory lock is visible across sessions.
  let locked=false;
  for(let attempt=0;attempt<30&&!locked;attempt++) {
    locked=success(await query(`select exists(select 1 from pg_locks where locktype='advisory' and granted and ((classid::bigint << 32) | objid::bigint)=hashtextextended('${user}',0));`)).trim()==="t";
    if(!locked) await new Promise(resolve=>setTimeout(resolve,30));
  }
  assert.equal(locked,true,"first checkout held the per-customer lock");
  const second=query(`select (${schema}.accept_match_basket('${user}','${q2}','${p2}','concurrency-second')).id;`);
  const [a,b]=await Promise.all([first,second]);
  success(a); assert.notEqual(b.code,0); assert.match(b.error,/CHECKOUT_ALREADY_PENDING/);
  assert.equal(success(await query(`select count(*) from ${schema}.match_basket_payments;`)).trim(),"1");
  const grants=await Promise.all([query(`select ${schema}.finish_match_basket('${p1}','successful',now());`),query(`select ${schema}.finish_match_basket('${p1}','successful',now());`)]);
  grants.forEach(result=>assert.match(success(result),/successful/));
  assert.equal(success(await query(`select count(*) from ${schema}.customer_match_entitlements;`)).trim(),"1");
  const hashAfter=success(await query(hashSql)).trim(); assert.equal(hashAfter,hashBefore);
  const evidence={isolatedContainer:container,databaseAssertions,concurrentCheckout:"one accepted, overlapping checkout rejected",concurrentWebhook:"both acknowledged, one entitlement",stagingForecastRowsHashBefore:hashBefore,stagingForecastRowsHashAfter:hashAfter,productionAccessed:false,realPayments:false};
  mkdirSync("output/pricing-v2",{recursive:true}); writeFileSync("output/pricing-v2/database-results.json",JSON.stringify(evidence,null,2)+"\n");
  console.log(JSON.stringify(evidence,null,2));
} finally {
  // Only our validated, unique temporary schema inside the fixed staging DB.
  success(await query(`drop schema ${schema} cascade;`));
}
