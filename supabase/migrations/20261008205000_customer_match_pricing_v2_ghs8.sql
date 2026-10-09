-- Correct prospectively; never update/delete an immutable quote or payment.
begin;
alter table public.match_basket_quotes alter column unit_pesewas drop not null;
alter table public.match_basket_quotes drop constraint match_basket_quotes_tier_check;
alter table public.match_basket_quotes drop constraint match_basket_quotes_check2;
alter table public.match_basket_quotes add constraint match_basket_quotes_policy_price check (
  case when policy_version='daily-match-v2-ghs8' then
    match_count between 1 and 10 and tier=match_count
    and total_pesewas = (array[800,1500,2100,2700,3300,3900,4500,5100,5700,6300])[match_count]
    and regular_pesewas=800*match_count
    and case when total_pesewas % match_count = 0 then
      unit_pesewas is not null and unit_pesewas=total_pesewas/match_count
    else unit_pesewas is null end
  else unit_pesewas is not null and tier in (1,2,4,6) and total_pesewas=unit_pesewas*match_count end
);
comment on column public.match_basket_quotes.unit_pesewas is 'Exact integer effective price when divisible; NULL for fractional pesewas. Exact effective price is total_pesewas/match_count. Total is the payment authority.';
create or replace function public.accept_match_basket(p_user uuid,p_quote uuid,p_payment uuid,p_reference text)
returns public.match_basket_payments language plpgsql security invoker set search_path='' as $$
declare q public.match_basket_quotes; payment public.match_basket_payments;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));
  select * into q from public.match_basket_quotes where id=p_quote and user_id=p_user;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  select * into payment from public.match_basket_payments where quote_id=p_quote and user_id=p_user;
  if found then return payment; end if;
  if q.policy_version <> 'daily-match-v2-ghs8' then raise exception 'BASKET_CHANGED_CONFIRM_AGAIN'; end if;
  if q.expires_at <= now() then raise exception 'QUOTE_EXPIRED'; end if;
  if exists(select 1 from public.customer_match_entitlements e join jsonb_array_elements(q.fixtures) f on e.match_id=f->>'match_id' where e.user_id=p_user) then raise exception 'ACCESS_ALREADY_GRANTED'; end if;
  if exists(select 1 from public.prediction_payments p join public.prediction_access_product_matches m on m.product_id=p.product_id join jsonb_array_elements(q.fixtures) f on m.match_id=f->>'match_id' where p.user_id=p_user and p.status in ('initialized','pending')) then raise exception 'CHECKOUT_ALREADY_PENDING'; end if;
  if exists(select 1 from public.match_checkout_reservations r join jsonb_array_elements(q.fixtures) f on r.match_id=f->>'match_id' where r.user_id=p_user) then raise exception 'CHECKOUT_ALREADY_PENDING'; end if;
  if (select count(distinct f->>'match_id') from jsonb_array_elements(q.fixtures) f) <> q.match_count then raise exception 'INVALID_SELECTION'; end if;
  insert into public.match_basket_payments(id,user_id,quote_id,provider_reference) values(p_payment,p_user,p_quote,p_reference) returning * into payment;
  insert into public.match_checkout_reservations(user_id,match_id,payment_id) select p_user,f->>'match_id',p_payment from jsonb_array_elements(q.fixtures) f;
  return payment;
end $$;
commit;
