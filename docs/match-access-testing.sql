-- Standalone Football Predictive Compass SQL Editor only.
-- Replace placeholders. Run grant and revoke sections separately.

-- Single-match product
with product as (
  insert into public.prediction_access_products
    (scope_type, prediction_stage, name, price_amount, currency, sales_close_at)
  values ('match', 'prematch', '<MATCH_NAME> Prematch', null, 'GHS', '<KICKOFF_UTC>'::timestamptz)
  returning id
)
insert into public.prediction_access_product_matches (product_id, match_id, kickoff_at)
select id, '<FM_MATCH_ID>', '<KICKOFF_UTC>'::timestamptz from product;

-- Kickoff-slot product: insert every authoritative fixture explicitly.
with product as (
  insert into public.prediction_access_products
    (scope_type, prediction_stage, name, price_amount, currency, sales_close_at)
  values ('kickoff_slot', 'prematch', '<KICKOFF_LABEL> Prematch Slot', null, 'GHS', '<KICKOFF_UTC>'::timestamptz)
  returning id
)
insert into public.prediction_access_product_matches (product_id, match_id, kickoff_at)
select product.id, fixture.match_id, '<KICKOFF_UTC>'::timestamptz
from product cross join (values ('<MATCH_A_ID>'), ('<MATCH_B_ID>')) as fixture(match_id);

-- Grant an existing product.
insert into public.prediction_access_grants (user_id, product_id)
values ('<TEST_CUSTOMER_UUID>'::uuid, '<PRODUCT_UUID>'::uuid);

-- Revoke a grant.
delete from public.prediction_access_grants
where user_id = '<TEST_CUSTOMER_UUID>'::uuid and product_id = '<PRODUCT_UUID>'::uuid;
