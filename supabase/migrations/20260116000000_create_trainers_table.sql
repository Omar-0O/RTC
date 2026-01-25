-- Create trainers table
CREATE TABLE IF NOT EXISTS public.trainers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    phone TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add trainer_id to courses table
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;

-- Policies for trainers: View for everyone
DROP POLICY IF EXISTS "View trainers for everyone" ON public.trainers;
CREATE POLICY "View trainers for everyone" ON public.trainers
    FOR SELECT USING (true);

-- Policies for trainers: Manage for heads and admin
DROP POLICY IF EXISTS "Manage trainers for heads" ON public.trainers;
CREATE POLICY "Manage trainers for heads" ON public.trainers
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader')
        )
    );

-- Create function to get trainer statistics
CREATE OR REPLACE FUNCTION get_trainer_stats(p_trainer_id UUID)
RETURNS TABLE (
    courses_count INTEGER,
    certificates_delivered_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE((
            SELECT COUNT(*)::INTEGER 
            FROM courses 
            WHERE trainer_id = p_trainer_id
        ), 0) as courses_count,
        COALESCE((
            SELECT COUNT(cb.id)::INTEGER
            FROM course_beneficiaries cb
            JOIN courses c ON cb.course_id = c.id
            WHERE c.trainer_id = p_trainer_id 
              AND c.has_certificates = true 
              AND c.certificate_status = 'delivered'
        ), 0) as certificates_delivered_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on table
COMMENT ON TABLE public.trainers IS 'Stores course trainers information';
COMMENT ON COLUMN public.trainers.name_en IS 'Trainer name in English';
COMMENT ON COLUMN public.trainers.name_ar IS 'Trainer name in Arabic';
COMMENT ON COLUMN public.trainers.phone IS 'Trainer phone number';
COMMENT ON COLUMN public.trainers.image_url IS 'URL to trainer profile image';
