-- Create quran_teachers table
CREATE TABLE public.quran_teachers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    phone text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on quran_teachers (mirroring other tables, usually public or role-based)
ALTER TABLE public.quran_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.quran_teachers
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.quran_teachers
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.quran_teachers
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.quran_teachers
    FOR DELETE USING (auth.role() = 'authenticated');


-- Add teacher_id to quran_circles
ALTER TABLE public.quran_circles
ADD COLUMN teacher_id uuid REFERENCES public.quran_teachers(id);

-- Comment on table
COMMENT ON TABLE public.quran_teachers IS 'List of Quran teachers';
