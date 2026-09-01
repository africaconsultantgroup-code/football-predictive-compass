create table public.prediction_access_products (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('match', 'kickoff_slot')),
  prediction_stage text not null check (prediction_stage in ('prematch', 'live', 'halftime')),
  name text not null check (length(btrim(name)) > 0),
  price_amount numeric(12,2) check (price_amount is null or price_amount >= 0),
  currency text not null default 'GHS' check (currency ~ '^[A-Z]{3}$'),
  is_active boolean not null default true,
  sales_open_at timestamptz,
  sales_close_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sales_close_at is null or sales_open_at is null or sales_close_at > sales_open_at)
);

create table public.prediction_access_product_matches (
  product_id uuid not null references public.prediction_access_products(id) on delete cascade,
  match_id text not null check (match_id ~ '^fm_[a-f0-9]{32}$'),
  kickoff_at timestamptz not null,
  primary key (product_id, match_id)
);

create index prediction_access_product_matches_match_lookup
on public.prediction_access_product_matches (match_id, product_id);
create index prediction_access_product_matches_slot_lookup
on public.prediction_access_product_matches (kickoff_at, product_id);

create table public.prediction_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.prediction_access_products(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > granted_at),
  unique (user_id, product_id)
);

create index prediction_access_grants_customer_lookup
on public.prediction_access_grants (user_id, expires_at);

alter table public.prediction_access_products enable row level security;
alter table public.prediction_access_product_matches enable row level security;
alter table public.prediction_access_grants enable row level security;

revoke all on table public.prediction_access_products from anon, authenticated;
revoke all on table public.prediction_access_product_matches from anon, authenticated;
revoke all on table public.prediction_access_grants from anon, authenticated;
grant select on table public.prediction_access_products to anon, authenticated;
grant select on table public.prediction_access_product_matches to anon, authenticated;
grant select on table public.prediction_access_grants to authenticated;

create policy "Customers can view active prediction products"
on public.prediction_access_products for select to anon, authenticated
using (
  is_active = true
  and ((sales_open_at is null or sales_open_at <= now())
    and (sales_close_at is null or sales_close_at > now())
    or exists (select 1 from public.prediction_access_grants
      where prediction_access_grants.product_id = prediction_access_products.id
        and prediction_access_grants.user_id = (select auth.uid())
        and (prediction_access_grants.expires_at is null or prediction_access_grants.expires_at > now())))
);

create policy "Customers can view active product fixture membership"
on public.prediction_access_product_matches for select to anon, authenticated
using (exists (
  select 1 from public.prediction_access_products
  where prediction_access_products.id = prediction_access_product_matches.product_id
    and prediction_access_products.is_active = true
    and ((prediction_access_products.sales_open_at is null or prediction_access_products.sales_open_at <= now())
      and (prediction_access_products.sales_close_at is null or prediction_access_products.sales_close_at > now())
      or exists (select 1 from public.prediction_access_grants
        where prediction_access_grants.product_id = prediction_access_products.id
          and prediction_access_grants.user_id = (select auth.uid())
          and (prediction_access_grants.expires_at is null or prediction_access_grants.expires_at > now())))
));

create policy "Customers can view their own prediction grants"
on public.prediction_access_grants for select to authenticated
using ((select auth.uid()) = user_id);

create trigger set_prediction_access_products_updated_at
before update on public.prediction_access_products
for each row execute function private.set_profile_updated_at();

create or replace function private.validate_prediction_product_membership()
returns trigger language plpgsql set search_path = '' as $$
declare product_scope text;
begin
  select scope_type into product_scope from public.prediction_access_products where id = new.product_id;
  if product_scope = 'match' and exists (
    select 1 from public.prediction_access_product_matches where product_id = new.product_id
  ) then raise exception 'A match product may contain exactly one fixture.';
  end if;
  if product_scope = 'kickoff_slot' and exists (
    select 1 from public.prediction_access_product_matches
    where product_id = new.product_id and kickoff_at <> new.kickoff_at
  ) then raise exception 'Kickoff-slot fixtures must share the exact UTC kickoff.';
  end if;
  return new;
end;
$$;
revoke execute on function private.validate_prediction_product_membership() from public, anon, authenticated;
create trigger validate_prediction_product_membership_before_insert
before insert on public.prediction_access_product_matches
for each row execute function private.validate_prediction_product_membership();
