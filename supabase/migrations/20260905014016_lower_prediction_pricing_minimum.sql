begin;

alter table public.prediction_pricing_rules
  drop constraint if exists prediction_pricing_rules_minimum_price_check;
alter table public.prediction_pricing_rules
  alter column minimum_price set default 10;
alter table public.prediction_pricing_rules
  add constraint prediction_pricing_rules_minimum_price_check
  check (minimum_price >= 10) not valid;

update public.prediction_pricing_rules
set base_match_count = values_table.base_match_count,
    base_price = values_table.base_price,
    additional_match_price = values_table.additional_match_price,
    minimum_price = 10,
    is_active = true
from (values
  ('match', 'prematch', 1, 10.00::numeric, 0.00::numeric),
  ('match', 'live', 1, 12.50::numeric, 0.00::numeric),
  ('match', 'halftime', 1, 15.00::numeric, 0.00::numeric),
  ('kickoff_slot', 'prematch', 2, 17.50::numeric, 7.50::numeric),
  ('kickoff_slot', 'live', 2, 22.50::numeric, 10.00::numeric),
  ('kickoff_slot', 'halftime', 2, 27.50::numeric, 12.50::numeric)
) as values_table(scope_type, prediction_stage, base_match_count, base_price, additional_match_price)
where prediction_pricing_rules.scope_type = values_table.scope_type
  and prediction_pricing_rules.prediction_stage = values_table.prediction_stage
  and prediction_pricing_rules.currency = 'GHS';

alter table public.prediction_pricing_rules
  validate constraint prediction_pricing_rules_minimum_price_check;

alter table public.prediction_access_products
  drop constraint if exists prediction_access_products_minimum_sellable_price;

-- Reprice only active GHS products without a successful historical payment.
-- Payment snapshots, provider references and access grants are never updated.
with eligible_products as (
  select p.id,
    private.calculate_prediction_product_price(
      p.scope_type,
      p.prediction_stage,
      count(pm.match_id)::integer,
      'GHS'
    ) as calculated_price
  from public.prediction_access_products p
  join public.prediction_access_product_matches pm on pm.product_id = p.id
  where p.is_active = true
    and p.currency = 'GHS'
    and not exists (
      select 1
      from public.prediction_payments payment
      where payment.product_id = p.id
        and payment.status = 'successful'
    )
  group by p.id, p.scope_type, p.prediction_stage
  having (p.scope_type = 'match' and count(*) = 1)
    or (p.scope_type = 'kickoff_slot' and count(*) >= 2 and count(distinct pm.kickoff_at) = 1)
)
update public.prediction_access_products product
set price_amount = eligible.calculated_price
from eligible_products eligible
where product.id = eligible.id;

alter table public.prediction_access_products
  add constraint prediction_access_products_minimum_sellable_price
  check (
    price_amount is null
    or (currency = 'GHS' and price_amount >= 10)
    or (currency <> 'GHS' and price_amount >= 0)
  ) not valid;
alter table public.prediction_access_products
  validate constraint prediction_access_products_minimum_sellable_price;

comment on table public.prediction_pricing_rules is
  'Trusted active pricing policy with a GHS 10 minimum. Customer roles have no table privileges.';

commit;
