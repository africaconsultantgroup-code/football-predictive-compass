create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_valid_period check (ends_at is null or ends_at > starts_at)
);

create unique index subscriptions_one_current_access_per_customer
on public.subscriptions (user_id)
where status in ('active', 'trialing');

create index subscriptions_customer_lookup
on public.subscriptions (user_id, status, ends_at);

create table public.plan_entitlements (
  plan_id uuid not null references public.plans(id) on delete cascade,
  capability text not null,
  primary key (plan_id, capability)
);

insert into public.plans (code, name, description)
values ('full_access', 'Full Access', 'Complete Football Predictive Compass access.');

insert into public.plan_entitlements (plan_id, capability)
select plans.id, capabilities.capability
from public.plans
cross join (values
  ('football.prematch.full'),
  ('football.live.full'),
  ('football.timeline.full')
) as capabilities(capability)
where plans.code = 'full_access';

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.plan_entitlements enable row level security;

revoke all on table public.plans from anon, authenticated;
revoke all on table public.subscriptions from anon, authenticated;
revoke all on table public.plan_entitlements from anon, authenticated;

grant select on table public.plans to authenticated;
grant select on table public.subscriptions to authenticated;
grant select on table public.plan_entitlements to authenticated;

create policy "Customers can view active plans"
on public.plans for select
to authenticated
using (is_active = true);

create policy "Customers can view their own subscriptions"
on public.subscriptions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Customers can view plan capabilities"
on public.plan_entitlements for select
to authenticated
using (
  exists (
    select 1
    from public.plans
    where plans.id = plan_entitlements.plan_id
      and plans.is_active = true
  )
);

create trigger set_plans_updated_at_before_update
before update on public.plans
for each row execute function private.set_profile_updated_at();

create trigger set_subscriptions_updated_at_before_update
before update on public.subscriptions
for each row execute function private.set_profile_updated_at();
