-- Allow authenticated users to view all user roles (mirrors profiles visibility)
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "User roles are viewable by authenticated users" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

-- Ensure specific high-level roles can manage roles (if not already covered by admin policy)
-- Note: Admin policy handles 'admin' role. If HR/Head HR needs to manage, we might need more policies.
-- For now, focused on fixing the "view" issue.
