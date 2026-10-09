-- Additive customer commerce only. No forecasting tables or stored vectors touched.
begin;
create table public.match_basket_quotes (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete restrict,
  policy_version text not null, currency text not null check (currency = 'GHS'),
  ghana_date date not null, fixtures jsonb not null check (jsonb_typeof(fixtures) = 'array'),
  match_count integer not null check (match_count between 1 and 100),
  tier integer not null check (tier in (1,2,4,6)),
  unit_pesewas integer not null check (unit_pesewas > 0),
  regular_pesewas integer not null, discount_pesewas integer not null check (discount_pesewas >= 0),
  total_pesewas integer not null check (total_pesewas > 0),
  created_at timestamptz not null default now(), expires_at timestamptz not null,
  check (expires_at > created_at), check (jsonb_array_length(fixtures) = match_count),
  check (total_pesewas = unit_pesewas * match_count),
  check (regular_pesewas = total_pesewas + discount_pesewas)
);
create index match_basket_quotes_customer on public.match_basket_quotes(user_id, created_at desc);
create table public.match_basket_payments (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete restrict,
  quote_id uuid not null unique references public.match_basket_quotes(id) on delete restrict,
  provider_reference text not null unique,
  status text not null default 'initialized' check (status in ('initialized','pending','successful','failed','abandoned','reversed','grant_failed')),
  authorization_url text, created_at timestamptz not null default now(), paid_at timestamptz
);
create index match_basket_payments_customer on public.match_basket_payments(user_id, created_at desc);
create table public.customer_match_entitlements (
  user_id uuid not null references auth.users(id) on delete restrict,
  match_id text not null check (match_id ~ '^fm_[a-f0-9]{32}$'), kickoff_at timestamptz not null,
  granted_at timestamptz not null default now(),
  legacy_payment_id uuid references public.prediction_payments(id) on delete restrict,
  basket_payment_id uuid references public.match_basket_payments(id) on delete restrict,
  primary key(user_id,match_id),
  check (num_nonnulls(legacy_payment_id,basket_payment_id) = 1)
);
create index customer_match_entitlements_legacy_payment on public.customer_match_entitlements(legacy_payment_id) where legacy_payment_id is not null;
create index customer_match_entitlements_basket_payment on public.customer_match_entitlements(basket_payment_id) where basket_payment_id is not null;
create table public.match_checkout_reservations (
  user_id uuid not null references auth.users(id) on delete restrict,
  match_id text not null, payment_id uuid not null references public.match_basket_payments(id) on delete restrict,
  primary key(user_id,match_id)
);
create index match_checkout_reservations_payment on public.match_checkout_reservations(payment_id);

alter table public.match_basket_quotes enable row level security;
alter table public.match_basket_payments enable row level security;
alter table public.customer_match_entitlements enable row level security;
alter table public.match_checkout_reservations enable row level security;
revoke all on public.match_basket_quotes, public.match_basket_payments, public.customer_match_entitlements, public.match_checkout_reservations from public, anon, authenticated;
grant select on public.match_basket_quotes, public.match_basket_payments, public.customer_match_entitlements to authenticated;
grant all on public.match_basket_quotes, public.match_basket_payments, public.customer_match_entitlements, public.match_checkout_reservations to service_role;
create policy "Own basket quotes" on public.match_basket_quotes for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own basket payments" on public.match_basket_payments for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own permanent match access" on public.customer_match_entitlements for select to authenticated using ((select auth.uid()) = user_id);

-- Do not reinterpret unpaid/failed payments as purchases. Keep every legacy grant
-- intact; successful purchases gain full-match ownership even after expiry.
insert into public.customer_match_entitlements(user_id,match_id,kickoff_at,granted_at,legacy_payment_id)
select distinct on(p.user_id,m.match_id) p.user_id,m.match_id,m.kickoff_at,coalesce(p.paid_at,p.created_at),p.id
from public.prediction_payments p join public.prediction_access_product_matches m on m.product_id=p.product_id
where p.status='successful'
order by p.user_id,m.match_id,coalesce(p.paid_at,p.created_at),p.id
on conflict(user_id,match_id) do nothing;

create function private.preserve_legacy_match_purchase() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.status='successful' then
    insert into public.customer_match_entitlements(user_id,match_id,kickoff_at,granted_at,legacy_payment_id)
    select new.user_id,m.match_id,m.kickoff_at,coalesce(new.paid_at,now()),new.id
    from public.prediction_access_product_matches m where m.product_id=new.product_id
    on conflict(user_id,match_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function private.preserve_legacy_match_purchase() from public,anon,authenticated;
create trigger preserve_legacy_match_purchase after insert or update of status on public.prediction_payments
for each row execute function private.preserve_legacy_match_purchase();

-- Quotes are immutable even to service writers; acceptance binds their exact IDs,
-- tier, amount and fixture identity to one provider transaction.
create function private.immutable_match_quote() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Accepted pricing snapshots are immutable'; end $$;
revoke all on function private.immutable_match_quote() from public,anon,authenticated;
create trigger immutable_match_quote before update or delete on public.match_basket_quotes for each row execute function private.immutable_match_quote();

create function public.accept_match_basket(p_user uuid,p_quote uuid,p_payment uuid,p_reference text)
returns public.match_basket_payments language plpgsql security invoker set search_path='' as $$
declare q public.match_basket_quotes; payment public.match_basket_payments;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));
  select * into q from public.match_basket_quotes where id=p_quote and user_id=p_user;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  select * into payment from public.match_basket_payments where quote_id=p_quote and user_id=p_user;
  if found then return payment; end if;
  if q.expires_at <= now() then raise exception 'QUOTE_EXPIRED'; end if;
  if exists(select 1 from public.customer_match_entitlements e join jsonb_array_elements(q.fixtures) f on e.match_id=f->>'match_id' where e.user_id=p_user) then raise exception 'ACCESS_ALREADY_GRANTED'; end if;
  if exists(select 1 from public.prediction_payments p join public.prediction_access_product_matches m on m.product_id=p.product_id join jsonb_array_elements(q.fixtures) f on m.match_id=f->>'match_id' where p.user_id=p_user and p.status in ('initialized','pending')) then raise exception 'CHECKOUT_ALREADY_PENDING'; end if;
  if exists(select 1 from public.match_checkout_reservations r join jsonb_array_elements(q.fixtures) f on r.match_id=f->>'match_id' where r.user_id=p_user) then raise exception 'CHECKOUT_ALREADY_PENDING'; end if;
  if (select count(distinct f->>'match_id') from jsonb_array_elements(q.fixtures) f) <> q.match_count then raise exception 'INVALID_SELECTION'; end if;
  insert into public.match_basket_payments(id,user_id,quote_id,provider_reference) values(p_payment,p_user,p_quote,p_reference) returning * into payment;
  insert into public.match_checkout_reservations(user_id,match_id,payment_id) select p_user,f->>'match_id',p_payment from jsonb_array_elements(q.fixtures) f;
  return payment;
end $$;
revoke all on function public.accept_match_basket(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.accept_match_basket(uuid,uuid,uuid,text) to service_role;

create function public.finish_match_basket(p_payment uuid,p_status text,p_paid_at timestamptz default null)
returns text language plpgsql security invoker set search_path='' as $$
declare payment public.match_basket_payments; q public.match_basket_quotes; customer uuid;
begin
  select user_id into customer from public.match_basket_payments where id=p_payment;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(customer::text,0));
  select * into payment from public.match_basket_payments where id=p_payment for update;
  if payment.status='successful' then return 'successful'; end if;
  if p_status not in ('successful','pending','failed','abandoned','reversed','grant_failed') then raise exception 'INVALID_PAYMENT_STATUS'; end if;
  if p_status='successful' then
    select * into q from public.match_basket_quotes where id=payment.quote_id;
    -- A late success after a released reservation must not collide with a newer
    -- checkout. Keep it for reconciliation instead of silently granting twice.
    if exists(select 1 from jsonb_array_elements(q.fixtures) f where not exists(select 1 from public.match_checkout_reservations r where r.user_id=customer and r.match_id=f->>'match_id' and r.payment_id=p_payment))
       or exists(select 1 from public.customer_match_entitlements e join jsonb_array_elements(q.fixtures) f on e.match_id=f->>'match_id' where e.user_id=customer) then
      update public.match_basket_payments set status='grant_failed',paid_at=p_paid_at where id=p_payment;
      return 'grant_failed';
    end if;
    insert into public.customer_match_entitlements(user_id,match_id,kickoff_at,basket_payment_id,granted_at)
    select customer,f->>'match_id',(f->>'kickoff_at')::timestamptz,p_payment,coalesce(p_paid_at,now()) from jsonb_array_elements(q.fixtures) f;
  end if;
  update public.match_basket_payments set status=p_status,paid_at=coalesce(p_paid_at,paid_at) where id=p_payment;
  if p_status in ('successful','failed','abandoned','reversed') then delete from public.match_checkout_reservations where payment_id=p_payment; end if;
  return p_status;
end $$;
revoke all on function public.finish_match_basket(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.finish_match_basket(uuid,text,timestamptz) to service_role;
commit;
