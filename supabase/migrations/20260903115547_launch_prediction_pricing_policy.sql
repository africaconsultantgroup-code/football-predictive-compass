create table public.prediction_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('match', 'kickoff_slot')),
  prediction_stage text not null check (prediction_stage in ('prematch', 'live', 'halftime')),
  currency text not null default 'GHS' check (currency ~ '^[A-Z]{3}$'),
  base_match_count integer not null check (base_match_count > 0),
  base_price numeric(12,2) not null check (base_price >= 0),
  additional_match_price numeric(12,2) not null default 0 check (additional_match_price >= 0),
  minimum_price numeric(12,2) not null default 20 check (minimum_price >= 20),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope_type, prediction_stage, currency),
  check (
    (scope_type = 'match' and base_match_count = 1 and additional_match_price = 0)
    or (scope_type = 'kickoff_slot' and base_match_count >= 2)
  )
);

alter table public.prediction_pricing_rules enable row level security;
revoke all on table public.prediction_pricing_rules from public, anon, authenticated;

create trigger set_prediction_pricing_rules_updated_at
before update on public.prediction_pricing_rules
for each row execute function private.set_profile_updated_at();

insert into public.prediction_pricing_rules
  (scope_type, prediction_stage, currency, base_match_count, base_price, additional_match_price, minimum_price)
values
  ('match', 'prematch', 'GHS', 1, 20, 0, 20),
  ('match', 'live', 'GHS', 1, 25, 0, 20),
  ('match', 'halftime', 'GHS', 1, 30, 0, 20),
  ('kickoff_slot', 'prematch', 'GHS', 2, 35, 15, 20),
  ('kickoff_slot', 'live', 'GHS', 2, 45, 20, 20),
  ('kickoff_slot', 'halftime', 'GHS', 2, 55, 25, 20)
on conflict (scope_type, prediction_stage, currency) do nothing;

create or replace function private.calculate_prediction_product_price(
  requested_scope_type text,
  requested_prediction_stage text,
  requested_match_count integer,
  requested_currency text default 'GHS'
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  pricing_rule public.prediction_pricing_rules%rowtype;
  calculated_price numeric(12,2);
begin
  if requested_scope_type = 'match' and requested_match_count <> 1 then
    raise exception 'A match product requires exactly one authoritative member.';
  end if;
  if requested_scope_type = 'kickoff_slot' and requested_match_count < 2 then
    raise exception 'A kickoff-slot product requires at least two authoritative members.';
  end if;

  select * into pricing_rule
  from public.prediction_pricing_rules
  where scope_type = requested_scope_type
    and prediction_stage = requested_prediction_stage
    and currency = requested_currency
    and is_active = true;

  if not found then
    raise exception 'No active prediction pricing rule is available.';
  end if;
  if requested_match_count < pricing_rule.base_match_count then
    raise exception 'Product membership is below the pricing rule minimum.';
  end if;

  calculated_price := pricing_rule.base_price
    + (requested_match_count - pricing_rule.base_match_count) * pricing_rule.additional_match_price;
  return greatest(calculated_price, pricing_rule.minimum_price);
end;
$$;

revoke execute on function private.calculate_prediction_product_price(text, text, integer, text)
from public, anon, authenticated;
grant execute on function private.calculate_prediction_product_price(text, text, integer, text)
to service_role;

create or replace function private.finalize_prediction_access_product(requested_product_id uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_record public.prediction_access_products%rowtype;
  authoritative_match_count integer;
  calculated_price numeric(12,2);
begin
  select * into product_record
  from public.prediction_access_products
  where id = requested_product_id
  for update;

  if not found then raise exception 'Prediction access product not found.'; end if;

  -- Finalization is intentionally idempotent and never reprices a non-null product.
  if product_record.price_amount is not null then return product_record.price_amount; end if;
  if exists (select 1 from public.prediction_payments where product_id = requested_product_id) then
    raise exception 'A product with payment activity cannot be automatically priced.';
  end if;

  select count(*) into authoritative_match_count
  from public.prediction_access_product_matches
  where product_id = requested_product_id;

  calculated_price := private.calculate_prediction_product_price(
    product_record.scope_type,
    product_record.prediction_stage,
    authoritative_match_count,
    'GHS'
  );

  update public.prediction_access_products
  set price_amount = calculated_price, currency = 'GHS'
  where id = requested_product_id and price_amount is null;
  return calculated_price;
end;
$$;

revoke execute on function private.finalize_prediction_access_product(uuid)
from public, anon, authenticated;
grant execute on function private.finalize_prediction_access_product(uuid)
to service_role;

-- Price only complete, structurally valid, currently unpriced products.
do $$
declare candidate record;
begin
  for candidate in
    select p.id
    from public.prediction_access_products p
    join public.prediction_access_product_matches pm on pm.product_id = p.id
    where p.price_amount is null
    group by p.id, p.scope_type
    having (p.scope_type = 'match' and count(*) = 1)
      or (p.scope_type = 'kickoff_slot' and count(*) >= 2 and count(distinct pm.kickoff_at) = 1)
  loop
    perform private.finalize_prediction_access_product(candidate.id);
  end loop;
end;
$$;

alter table public.prediction_access_products
  drop constraint if exists prediction_access_products_price_amount_check;
alter table public.prediction_access_products
  add constraint prediction_access_products_minimum_sellable_price
  check (
    price_amount is null
    or (currency = 'GHS' and price_amount >= 20)
    or (currency <> 'GHS' and price_amount >= 0)
  ) not valid;
alter table public.prediction_access_products
  validate constraint prediction_access_products_minimum_sellable_price;

comment on table public.prediction_pricing_rules is
  'Trusted launch pricing policy. Customer roles have no table privileges.';
comment on function private.finalize_prediction_access_product(uuid) is
  'Call only after the immutable product membership snapshot is complete; null prices only.';
