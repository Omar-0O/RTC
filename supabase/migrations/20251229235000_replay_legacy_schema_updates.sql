-- Replay historical migrations that were timestamped before the checked-in
-- baseline schema. This makes `supabase db reset` deterministic from scratch.

ALTER TABLE public.activity_submissions
  ADD COLUMN IF NOT EXISTS location text DEFAULT 'branch' CHECK (location IN ('branch', 'home'));

ALTER TABLE public.activity_submissions DROP COLUMN IF EXISTS hours_spent;

ALTER TYPE public.volunteer_level ADD VALUE IF NOT EXISTS 'under_follow_up';
ALTER TYPE public.volunteer_level ADD VALUE IF NOT EXISTS 'project_responsible';
ALTER TYPE public.volunteer_level ADD VALUE IF NOT EXISTS 'responsible';

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_hr';

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.rooms;
DROP POLICY IF EXISTS "Enable insert for admins" ON public.rooms;
DROP POLICY IF EXISTS "Enable update for admins" ON public.rooms;
DROP POLICY IF EXISTS "Enable delete for admins" ON public.rooms;

CREATE POLICY "Enable read access for all users" ON public.rooms
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for admins" ON public.rooms
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Enable update for admins" ON public.rooms
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Enable delete for admins" ON public.rooms
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
