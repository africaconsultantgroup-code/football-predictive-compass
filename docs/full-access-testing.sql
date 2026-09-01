-- Run only in the standalone Football Predictive Compass Supabase SQL Editor.
-- Replace the placeholder with the existing test customer's auth.users UUID.

-- Grant Full Access (run only this statement to grant)
insert into public.subscriptions (user_id, plan_id, status)
select '<TEST_CUSTOMER_UUID>'::uuid, plans.id, 'active'
from public.plans
where plans.code = 'full_access';

-- Revoke Full Access (run only this statement to revoke)
update public.subscriptions
set status = 'canceled', updated_at = now()
where user_id = '<TEST_CUSTOMER_UUID>'::uuid
  and status in ('active', 'trialing');
