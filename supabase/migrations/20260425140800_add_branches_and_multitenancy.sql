-- 1. Create Branches table
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Basic RLS for branches
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branches are viewable by everyone" ON public.branches
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage branches" ON public.branches
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 2. Insert Default Branch ('المهندسين')
INSERT INTO public.branches (id, name, name_ar, is_default)
VALUES (gen_random_uuid(), 'Mohandeseen', 'المهندسين', true)
ON CONFLICT DO NOTHING;

-- Create function to get default branch
CREATE OR REPLACE FUNCTION get_default_branch_id() RETURNS UUID AS $$
    SELECT id FROM public.branches WHERE is_default = true LIMIT 1;
$$ LANGUAGE sql STABLE;


-- 3. Add branch_id to major tables

-- profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.profiles SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;
-- In the future, once all users are assigned: ALTER TABLE public.profiles ALTER COLUMN branch_id SET NOT NULL;

-- activity_submissions
ALTER TABLE public.activity_submissions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.activity_submissions SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- trainers
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.trainers SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.courses SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- quran_circles
ALTER TABLE public.quran_circles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.quran_circles SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- caravans
ALTER TABLE public.caravans ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.caravans SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.events SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- users_followup
ALTER TABLE public.users_followup ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.users_followup SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- Update users_followup existing records that have the string branch. We map the specific text to branch_id if possible. 
-- Since we only have Mohandeseen right now, everyone goes to get_default_branch_id().

-- 4. Automatically assign new users to default branch (if not specified)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_branch UUID;
BEGIN
  SELECT id INTO default_branch FROM public.branches WHERE is_default = true LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, branch_id)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', default_branch);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'volunteer');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to get user's branch
CREATE OR REPLACE FUNCTION public.get_user_branch_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.profiles WHERE id = _user_id;
$$;
