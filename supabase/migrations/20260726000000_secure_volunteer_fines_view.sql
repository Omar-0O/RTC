-- Ensure volunteer fine reports respect the querying user's RLS policies.
ALTER VIEW public.volunteer_fines_view
SET (security_invoker = true);
