-- Ensure rooms table exists
CREATE TABLE IF NOT EXISTS public.rooms (
    id text PRIMARY KEY,
    name text NOT NULL,
    name_ar text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean state and remove buggy ones
DROP POLICY IF EXISTS "Enable read access for all users" ON public.rooms;
DROP POLICY IF EXISTS "Enable insert for admins" ON public.rooms;
DROP POLICY IF EXISTS "Enable update for admins" ON public.rooms;
DROP POLICY IF EXISTS "Enable delete for admins" ON public.rooms;

-- Create policies with correct argument order for has_role
CREATE POLICY "Enable read access for all users" ON public.rooms
    FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for admins" ON public.rooms
    FOR INSERT
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Enable update for admins" ON public.rooms
    FOR UPDATE
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Enable delete for admins" ON public.rooms
    FOR DELETE
    USING (public.has_role(auth.uid(), 'admin'));

-- Seed initial data
INSERT INTO public.rooms (id, name, name_ar)
VALUES
    ('lab_1', 'Lab 1', 'لاب 1'),
    ('lab_2', 'Lab 2', 'لاب 2'),
    ('lab_3', 'Lab 3', 'لاب 3'),
    ('lab_4', 'Lab 4', 'لاب 4'),
    ('impact_hall', 'Impact Hall', 'قاعة الأثر')
ON CONFLICT (id) DO NOTHING;
