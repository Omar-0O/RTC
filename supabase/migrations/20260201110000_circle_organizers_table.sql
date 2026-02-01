-- Create circle_organizers junction table for multiple organizers per circle

CREATE TABLE IF NOT EXISTS public.quran_circle_organizers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.quran_circles(id) ON DELETE CASCADE,
    volunteer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(circle_id, volunteer_id)
);

-- Enable RLS
ALTER TABLE public.quran_circle_organizers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow read for authenticated" ON public.quran_circle_organizers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write for admin and head_quran" ON public.quran_circle_organizers
FOR ALL TO authenticated
USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'head_quran'))
WITH CHECK ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'head_quran'));

-- Index
CREATE INDEX IF NOT EXISTS idx_circle_organizers_circle ON public.quran_circle_organizers(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_organizers_volunteer ON public.quran_circle_organizers(volunteer_id);

-- Migrate existing organizer_id data to new table
INSERT INTO public.quran_circle_organizers (circle_id, volunteer_id, name, phone)
SELECT 
    c.id,
    c.organizer_id,
    COALESCE(p.full_name, 'Unknown'),
    p.phone
FROM public.quran_circles c
JOIN public.profiles p ON p.id = c.organizer_id
WHERE c.organizer_id IS NOT NULL;
