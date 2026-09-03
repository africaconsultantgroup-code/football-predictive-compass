create or replace function public.finalize_prediction_access_product(requested_product_id uuid)
returns numeric
language sql
security definer
set search_path = ''
as $$
  select private.finalize_prediction_access_product(requested_product_id);
$$;

revoke execute on function public.finalize_prediction_access_product(uuid)
from public, anon, authenticated;
grant execute on function public.finalize_prediction_access_product(uuid)
to service_role;

comment on function public.finalize_prediction_access_product(uuid) is
  'Service-role-only RPC for product synchronization after immutable membership is complete.';
