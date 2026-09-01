create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select, update on table public.profiles to authenticated;

drop policy if exists "Customers can view their own profile" on public.profiles;
create policy "Customers can view their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Customers can update their own profile" on public.profiles;
create policy "Customers can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function private.create_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.create_customer_profile()
from public, anon, authenticated, service_role;

drop trigger if exists create_customer_profile_after_signup on auth.users;
create trigger create_customer_profile_after_signup
after insert on auth.users
for each row execute function private.create_customer_profile();

create or replace function private.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_profile_updated_at()
from public, anon, authenticated, service_role;

drop trigger if exists set_profile_updated_at_before_update on public.profiles;
create trigger set_profile_updated_at_before_update
before update on public.profiles
for each row execute function private.set_profile_updated_at();

insert into public.profiles (id, display_name, created_at, updated_at)
select
  users.id,
  users.raw_user_meta_data ->> 'display_name',
  users.created_at,
  coalesce(users.updated_at, users.created_at)
from auth.users as users
on conflict (id) do nothing;
