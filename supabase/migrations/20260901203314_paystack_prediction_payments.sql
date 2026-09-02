create table public.prediction_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid not null references public.prediction_access_products(id) on delete restrict,
  provider text not null default 'paystack' check (provider = 'paystack'),
  provider_reference text not null unique,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in (
    'initialized', 'pending', 'successful', 'failed',
    'abandoned', 'reversed', 'grant_failed'
  )),
  grant_id uuid unique references public.prediction_access_grants(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index prediction_payments_customer_created
on public.prediction_payments (user_id, created_at desc);

alter table public.prediction_payments enable row level security;
revoke all on table public.prediction_payments from anon, authenticated;
grant select on table public.prediction_payments to authenticated;

create policy "Customers can view their own prediction payments"
on public.prediction_payments for select to authenticated
using ((select auth.uid()) = user_id);

create trigger set_prediction_payments_updated_at
before update on public.prediction_payments
for each row execute function private.set_profile_updated_at();

alter policy "Customers can view active prediction products"
on public.prediction_access_products
using (
  is_active = true
  and (
    ((sales_open_at is null or sales_open_at <= now()) and (sales_close_at is null or sales_close_at > now()))
    or exists (select 1 from public.prediction_access_grants
      where prediction_access_grants.product_id = prediction_access_products.id
        and prediction_access_grants.user_id = (select auth.uid())
        and (prediction_access_grants.expires_at is null or prediction_access_grants.expires_at > now()))
    or exists (select 1 from public.prediction_payments
      where prediction_payments.product_id = prediction_access_products.id
        and prediction_payments.user_id = (select auth.uid()))
  )
);
