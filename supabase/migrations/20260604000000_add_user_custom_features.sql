-- 1. Create user_features table
CREATE TABLE IF NOT EXISTS public.user_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    branch_id UUID REFERENCES public.branches(id)
);

-- Unique constraint to prevent duplicate features per user
ALTER TABLE public.user_features DROP CONSTRAINT IF EXISTS user_features_user_id_feature_key;
ALTER TABLE public.user_features ADD CONSTRAINT user_features_user_id_feature_key UNIQUE (user_id, feature);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_features_branch ON public.user_features(branch_id);
CREATE INDEX IF NOT EXISTS idx_user_features_user ON public.user_features(user_id);

-- 2. Create branch auto-injection trigger
DROP TRIGGER IF EXISTS trg_auto_branch_user_features ON public.user_features;
CREATE TRIGGER trg_auto_branch_user_features
  BEFORE INSERT ON public.user_features
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_branch_id();

-- 3. Enable RLS and setup policies
ALTER TABLE public.user_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_features_select" ON public.user_features;
CREATE POLICY "user_features_select" ON public.user_features FOR SELECT TO authenticated
  USING (
    public.is_admin_or_exec() 
    OR auth.uid() = user_id 
    OR branch_id = public.get_my_branch_id()
  );

DROP POLICY IF EXISTS "user_features_modify" ON public.user_features;
CREATE POLICY "user_features_modify" ON public.user_features FOR ALL TO authenticated
  USING (
    public.is_admin_or_exec() OR (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'branch_admin')
      AND branch_id = public.get_my_branch_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE public.profiles.id = public.user_features.user_id AND public.profiles.branch_id = public.get_my_branch_id()
      )
    )
  );

-- 4. Update profiles RLS policy to allow branch_admin to update profiles in their branch
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
        AND role::text IN ('admin','head_hr','hr','supervisor','executive','branch_admin')
    )
  );

-- 5. Update user_roles RLS policy to allow branch_admin to edit roles of users in their branch
DROP POLICY IF EXISTS "roles_modify" ON public.user_roles;
CREATE POLICY "roles_modify" ON public.user_roles FOR ALL TO authenticated
  USING (
    public.is_admin_or_exec() OR (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'branch_admin')
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE public.profiles.id = public.user_roles.user_id AND public.profiles.branch_id = public.get_my_branch_id()
      )
    )
  );
