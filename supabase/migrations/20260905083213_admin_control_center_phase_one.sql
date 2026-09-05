create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operations', 'finance', 'support')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_users to service_role;

create trigger set_admin_users_updated_at
before update on public.admin_users
for each row execute function private.set_profile_updated_at();

comment on table public.admin_users is
  'Server-authoritative internal operator membership. Customer roles have no privileges or policies.';
