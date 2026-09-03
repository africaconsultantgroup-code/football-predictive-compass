alter table public.prediction_access_products
  add column sync_key text;

alter table public.prediction_access_products
  add constraint prediction_access_products_sync_key_format
  check (sync_key is null or (length(sync_key) between 12 and 240 and sync_key ~ '^core:'));

create unique index prediction_access_products_sync_key_unique
on public.prediction_access_products (sync_key)
where sync_key is not null;

comment on column public.prediction_access_products.sync_key is
  'Trusted idempotency key derived from canonical Core match IDs, commercial stage, exact kickoff, and immutable slot membership.';
