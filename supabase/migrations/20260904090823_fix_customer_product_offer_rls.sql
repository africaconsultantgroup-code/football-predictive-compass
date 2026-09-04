create or replace function private.customer_can_view_prediction_product(requested_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.prediction_access_products product
    where product.id = requested_product_id
      and product.is_active = true
      and (
        ((product.sales_open_at is null or product.sales_open_at <= now())
          and (product.sales_close_at is null or product.sales_close_at > now()))
        or (
          (select auth.uid()) is not null
          and exists (
            select 1 from public.prediction_access_grants grant_record
            where grant_record.product_id = product.id
              and grant_record.user_id = (select auth.uid())
              and (grant_record.expires_at is null or grant_record.expires_at > now())
          )
        )
        or (
          (select auth.uid()) is not null
          and exists (
            select 1 from public.prediction_payments payment
            where payment.product_id = product.id
              and payment.user_id = (select auth.uid())
          )
        )
      )
  );
$$;

revoke all on function private.customer_can_view_prediction_product(uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.customer_can_view_prediction_product(uuid) to anon, authenticated;

drop policy if exists "Customers can view active prediction products"
on public.prediction_access_products;
create policy "Customers can view active prediction products"
on public.prediction_access_products for select to anon, authenticated
using (private.customer_can_view_prediction_product(id));

drop policy if exists "Customers can view active product fixture membership"
on public.prediction_access_product_matches;
create policy "Customers can view active product fixture membership"
on public.prediction_access_product_matches for select to anon, authenticated
using (private.customer_can_view_prediction_product(product_id));

comment on function private.customer_can_view_prediction_product(uuid) is
  'RLS predicate that exposes only active sellable products or products belonging to the current customer, without granting customer roles access to grant or payment tables.';
