-- Isolated database only. Every fixture here is explicitly a commerce test;
-- no forecast is inserted, changed or claimed as genuine. All writes roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(53);
insert into auth.users(id) values ('cc000000-0000-4000-8000-000000000001'),('cc000000-0000-4000-8000-000000000002');
insert into public.prediction_access_products(id,scope_type,prediction_stage,name,price_amount,currency,is_active)
values('cc100000-0000-4000-8000-000000000001','match','prematch','Pricing V2 legacy commerce test',20,'GHS',false);
insert into public.prediction_access_product_matches(product_id,match_id,kickoff_at)
values('cc100000-0000-4000-8000-000000000001','fm_cc000000000000000000000000000001','2025-01-01 12:00:00Z');
insert into public.prediction_access_grants(user_id,product_id,granted_at,expires_at)
values('cc000000-0000-4000-8000-000000000001','cc100000-0000-4000-8000-000000000001','2025-01-01','2025-01-02');
insert into public.prediction_payments(id,user_id,product_id,provider_reference,amount,currency,status)
values('cc200000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000001','cc100000-0000-4000-8000-000000000001','commerce-test-legacy',20,'GHS','successful');
select is((select count(*)::integer from public.customer_match_entitlements where legacy_payment_id='cc200000-0000-4000-8000-000000000001'),1,'successful historical purchase becomes permanent ownership despite expired grant/inactive product');
select is((select amount::text from public.prediction_payments where id='cc200000-0000-4000-8000-000000000001'),'20.00','historical payment not repriced');
select is((select expires_at::date::text from public.prediction_access_grants where product_id='cc100000-0000-4000-8000-000000000001'),'2025-01-02','legacy expiry not rewritten');
insert into public.match_basket_quotes(id,user_id,policy_version,currency,ghana_date,fixtures,match_count,tier,unit_pesewas,regular_pesewas,discount_pesewas,total_pesewas,expires_at)
select 'cc300000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000001','daily-match-v2-ghs8','GHS',current_date+1,
 jsonb_agg(jsonb_build_object('match_id','fm_cc00000000000000000000000000000'||i,'kickoff_at',(current_date+1)::timestamptz,'competition',case when i%2=0 then 'EPL' else 'UEFA Champions League' end,'home_team','Commerce test home','away_team','Commerce test away')),4,4,675,3200,500,2700,now()+interval '10 minutes'
from generate_series(2,5) i;
select lives_ok($$select public.accept_match_basket('cc000000-0000-4000-8000-000000000001','cc300000-0000-4000-8000-000000000001','cc400000-0000-4000-8000-000000000001','fpc-basket-commerce-test')$$,'accepts exact quote atomically');
select is((select count(*)::integer from public.match_checkout_reservations where payment_id='cc400000-0000-4000-8000-000000000001'),4,'reserves all four selected matches');
select is((select count(*)::integer from public.customer_match_entitlements where basket_payment_id='cc400000-0000-4000-8000-000000000001'),0,'no access before verification');
select is((public.accept_match_basket('cc000000-0000-4000-8000-000000000001','cc300000-0000-4000-8000-000000000001','cc400000-0000-4000-8000-000000000002','duplicate')).id,'cc400000-0000-4000-8000-000000000001'::uuid,'same quote resumes existing transaction');
insert into public.match_basket_quotes select 'cc300000-0000-4000-8000-000000000002',user_id,policy_version,currency,ghana_date,fixtures,match_count,tier,unit_pesewas,regular_pesewas,discount_pesewas,total_pesewas,created_at,expires_at from public.match_basket_quotes where id='cc300000-0000-4000-8000-000000000001';
select throws_ok($$select public.accept_match_basket('cc000000-0000-4000-8000-000000000001','cc300000-0000-4000-8000-000000000002','cc400000-0000-4000-8000-000000000002','overlap')$$,'P0001','CHECKOUT_ALREADY_PENDING','overlapping checkout cannot double-charge');
select throws_ok($$select public.accept_match_basket('cc000000-0000-4000-8000-000000000002','cc300000-0000-4000-8000-000000000001','cc400000-0000-4000-8000-000000000002','other')$$,'P0001','QUOTE_NOT_FOUND','other customer cannot accept quote');
select throws_ok($$update public.match_basket_quotes set total_pesewas=1 where id='cc300000-0000-4000-8000-000000000001'$$,'P0001','Accepted pricing snapshots are immutable','accepted quote cannot be manipulated');
select is(public.finish_match_basket('cc400000-0000-4000-8000-000000000001','successful',now()),'successful','verified payment fulfills atomically');
select is((select count(*)::integer from public.customer_match_entitlements where basket_payment_id='cc400000-0000-4000-8000-000000000001'),4,'exactly four permanent match grants');
select is((select count(*)::integer from public.match_checkout_reservations where payment_id='cc400000-0000-4000-8000-000000000001'),0,'successful payment releases reservations');
select is(public.finish_match_basket('cc400000-0000-4000-8000-000000000001','successful',now()),'successful','webhook replay idempotent');
select is((select count(*)::integer from public.customer_match_entitlements where basket_payment_id='cc400000-0000-4000-8000-000000000001'),4,'no duplicate grants');
select throws_ok($$select public.accept_match_basket('cc000000-0000-4000-8000-000000000001','cc300000-0000-4000-8000-000000000002','cc400000-0000-4000-8000-000000000002','owned')$$,'P0001','ACCESS_ALREADY_GRANTED','owned matches never repurchased');
select ok(not has_function_privilege('anon','public.accept_match_basket(uuid,uuid,uuid,text)','execute'),'anonymous cannot initialize privileged checkout');
select ok(not has_function_privilege('authenticated','public.finish_match_basket(uuid,text,timestamptz)','execute'),'customers cannot grant themselves paid access');
select ok(not has_table_privilege('authenticated','public.customer_match_entitlements','insert'),'customer cannot forge ownership');
select ok(not has_table_privilege('anon','public.match_basket_payments','select'),'anonymous cannot read payment records');
select set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*)::integer from public.customer_match_entitlements),0,'RLS hides another customer ownership');
select is((select count(*)::integer from public.match_basket_quotes),0,'RLS hides another customer quote');
select is((select count(*)::integer from public.match_basket_payments),0,'RLS hides another customer payment');
reset role;
select set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*)::integer from public.customer_match_entitlements),5,'owner can read legacy and new permanent access');
select is((select count(*)::integer from public.match_basket_payments),1,'owner sees the one basket transaction');
reset role;
-- A separate customer can retry after a provider-verified failure. A late
-- success on that old reference cannot steal the new checkout's reservations.
insert into public.match_basket_quotes select 'cc300000-0000-4000-8000-000000000003','cc000000-0000-4000-8000-000000000002',policy_version,currency,ghana_date,fixtures,match_count,tier,unit_pesewas,regular_pesewas,discount_pesewas,total_pesewas,created_at,expires_at from public.match_basket_quotes where id='cc300000-0000-4000-8000-000000000001';
select lives_ok($$select public.accept_match_basket('cc000000-0000-4000-8000-000000000002','cc300000-0000-4000-8000-000000000003','cc400000-0000-4000-8000-000000000003','fpc-basket-failure-test')$$,'second customer starts checkout');
select is(public.finish_match_basket('cc400000-0000-4000-8000-000000000003','failed'),'failed','provider verified failure recorded');
select is((select count(*)::integer from public.customer_match_entitlements where user_id='cc000000-0000-4000-8000-000000000002'),0,'failed payment grants nothing');
select is((select count(*)::integer from public.match_checkout_reservations where payment_id='cc400000-0000-4000-8000-000000000003'),0,'failure releases reservations');
insert into public.match_basket_quotes select 'cc300000-0000-4000-8000-000000000004','cc000000-0000-4000-8000-000000000002',policy_version,currency,ghana_date,fixtures,match_count,tier,unit_pesewas,regular_pesewas,discount_pesewas,total_pesewas,created_at,expires_at from public.match_basket_quotes where id='cc300000-0000-4000-8000-000000000001';
select lives_ok($$select public.accept_match_basket('cc000000-0000-4000-8000-000000000002','cc300000-0000-4000-8000-000000000004','cc400000-0000-4000-8000-000000000004','fpc-basket-retry-test')$$,'a new confirmed quote can retry after failure');
select is(public.finish_match_basket('cc400000-0000-4000-8000-000000000003','successful',now()),'grant_failed','late old success requires reconciliation');
select is((select count(*)::integer from public.match_checkout_reservations where payment_id='cc400000-0000-4000-8000-000000000004'),4,'new checkout reservations preserved');
select is(public.finish_match_basket('cc400000-0000-4000-8000-000000000004','successful',now()),'successful','new valid checkout grants once');
insert into public.match_basket_quotes select 'cc300000-0000-4000-8000-000000000005',user_id,policy_version,currency,ghana_date,fixtures,match_count,tier,unit_pesewas,regular_pesewas,discount_pesewas,total_pesewas,now()-interval '20 minutes',now()-interval '10 minutes' from public.match_basket_quotes where id='cc300000-0000-4000-8000-000000000001';
select throws_ok($$select public.accept_match_basket('cc000000-0000-4000-8000-000000000001','cc300000-0000-4000-8000-000000000005','cc400000-0000-4000-8000-000000000005','expired')$$,'P0001','QUOTE_EXPIRED','expired quote cannot initialize');
select ok(not has_table_privilege('authenticated','public.match_basket_quotes','update'),'customer cannot change quote price');
select ok(not has_table_privilege('authenticated','public.match_basket_payments','update'),'customer cannot mark payment successful');
select ok(not has_table_privilege('authenticated','public.customer_match_entitlements','delete'),'customer cannot delete ownership');
select ok(has_function_privilege('service_role','public.accept_match_basket(uuid,uuid,uuid,text)','execute'),'server can atomically accept quote');
select ok(has_function_privilege('service_role','public.finish_match_basket(uuid,text,timestamptz)','execute'),'server can atomically fulfill verified quote');
-- Explicit totals, including fractional effective prices, without extrapolation.
insert into public.match_basket_quotes(id,user_id,policy_version,currency,ghana_date,fixtures,match_count,tier,unit_pesewas,regular_pesewas,discount_pesewas,total_pesewas,expires_at)
select ('cc500000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'cc000000-0000-4000-8000-000000000001','daily-match-v2-ghs8','GHS',current_date+1,
 (select jsonb_agg(jsonb_build_object('match_id','fm_'||lpad(i::text,32,'e'),'kickoff_at',(current_date+1)::timestamptz)) from generate_series(1,n) i),
 n,n,case when t%n=0 then t/n else null end,800*n,800*n-t,t,now()+interval '10 minutes'
from unnest(array[800,1500,2100,2700,3300,3900,4500,5100,5700,6300]) with ordinality prices(t,n);
select is((select total_pesewas from public.match_basket_quotes where id=('cc500000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid),t,'exact approved total for '||n||' matches')
from unnest(array[800,1500,2100,2700,3300,3900,4500,5100,5700,6300]) with ordinality prices(t,n);
select is((select count(*)::integer from public.match_basket_quotes where policy_version='daily-match-v2-ghs8' and match_count in(7,8,9) and unit_pesewas is null),3,'fractional effective prices preserve exact total/count');
insert into public.match_basket_quotes(id,user_id,policy_version,currency,ghana_date,fixtures,match_count,tier,unit_pesewas,regular_pesewas,discount_pesewas,total_pesewas,expires_at)
select 'cc600000-0000-4000-8000-000000000001',user_id,'daily-match-v2',currency,ghana_date,fixtures,match_count,4,1600,8000,1600,6400,expires_at from public.match_basket_quotes where id='cc300000-0000-4000-8000-000000000001';
select throws_ok($$select public.accept_match_basket('cc000000-0000-4000-8000-000000000001','cc600000-0000-4000-8000-000000000001','cc600000-0000-4000-8000-000000000002','retired')$$,'P0001','BASKET_CHANGED_CONFIRM_AGAIN','old quote cannot create a new checkout');
select is((select total_pesewas from public.match_basket_quotes where id='cc600000-0000-4000-8000-000000000001'),6400,'old quote amount preserved');
select throws_ok($$insert into public.match_basket_quotes(id,user_id,policy_version,currency,ghana_date,fixtures,match_count,tier,unit_pesewas,regular_pesewas,discount_pesewas,total_pesewas,expires_at) select 'cc600000-0000-4000-8000-000000000003',user_id,'daily-match-v2-ghs8',currency,ghana_date,fixtures,match_count,4,1600,8000,1600,6400,expires_at from public.match_basket_quotes where id='cc300000-0000-4000-8000-000000000001'$$,'23514',null,'database rejects old price under new policy');
select * from finish();
rollback;
