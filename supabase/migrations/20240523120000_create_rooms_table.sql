-- Create rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
    id text PRIMARY KEY,
    name text NOT NULL,
    name_ar text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- The rooms table can be created before the baseline schema, but its policies
-- depend on public.has_role, which is created by the baseline. Those policies
-- are replayed after the baseline migration.
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Seed initial data (for backward compatibility)
INSERT INTO public.rooms (id, name, name_ar)
VALUES
    ('lab_1', 'Lab 1', 'لاب 1'),
    ('lab_2', 'Lab 2', 'لاب 2'),
    ('lab_3', 'Lab 3', 'لاب 3'),
    ('lab_4', 'Lab 4', 'لاب 4'),
    ('impact_hall', 'Impact Hall', 'قاعة الأثر')
ON CONFLICT (id) DO NOTHING;
