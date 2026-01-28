-- Course Marketing Section Migration
-- Add tables for course ads (marketing) and course marketers

-- =============================================
-- Course Ads table - stores marketing ads for each course
-- =============================================
CREATE TABLE IF NOT EXISTS course_ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
    ad_number INTEGER NOT NULL,
    ad_date DATE NOT NULL,
    poster_url TEXT,
    content TEXT,
    poster_done BOOLEAN DEFAULT false,
    content_done BOOLEAN DEFAULT false,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, ad_number)
);

-- =============================================
-- Course Marketers table - tracks which volunteers are assigned as marketers
-- =============================================
CREATE TABLE IF NOT EXISTS course_marketers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
    volunteer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, volunteer_id)
);

-- =============================================
-- Indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_course_ads_course_id ON course_ads(course_id);
CREATE INDEX IF NOT EXISTS idx_course_marketers_course_id ON course_marketers(course_id);
CREATE INDEX IF NOT EXISTS idx_course_marketers_volunteer_id ON course_marketers(volunteer_id);

-- =============================================
-- Enable Row Level Security
-- =============================================
ALTER TABLE course_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_marketers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies for course_ads
-- =============================================

-- Allow all authenticated users to read ads
DROP POLICY IF EXISTS "course_ads_select" ON course_ads;
CREATE POLICY "course_ads_select" ON course_ads 
    FOR SELECT TO authenticated 
    USING (true);

-- Allow marketers and admins/supervisors/leaders to insert ads
DROP POLICY IF EXISTS "course_ads_insert" ON course_ads;
CREATE POLICY "course_ads_insert" ON course_ads 
    FOR INSERT TO authenticated 
    WITH CHECK (
        EXISTS (SELECT 1 FROM course_marketers WHERE course_id = course_ads.course_id AND volunteer_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'committee_leader'))
    );

-- Allow marketers and admins/supervisors/leaders to update ads
DROP POLICY IF EXISTS "course_ads_update" ON course_ads;
CREATE POLICY "course_ads_update" ON course_ads 
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM course_marketers WHERE course_id = course_ads.course_id AND volunteer_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'committee_leader'))
    );

-- Allow admins/supervisors to delete ads
DROP POLICY IF EXISTS "course_ads_delete" ON course_ads;
CREATE POLICY "course_ads_delete" ON course_ads 
    FOR DELETE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
    );

-- =============================================
-- RLS Policies for course_marketers
-- =============================================

-- Allow all authenticated users to read marketers
DROP POLICY IF EXISTS "course_marketers_select" ON course_marketers;
CREATE POLICY "course_marketers_select" ON course_marketers 
    FOR SELECT TO authenticated 
    USING (true);

-- Allow admins/supervisors/leaders to manage marketers
DROP POLICY IF EXISTS "course_marketers_insert" ON course_marketers;
CREATE POLICY "course_marketers_insert" ON course_marketers 
    FOR INSERT TO authenticated 
    WITH CHECK (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'committee_leader'))
    );

DROP POLICY IF EXISTS "course_marketers_delete" ON course_marketers;
CREATE POLICY "course_marketers_delete" ON course_marketers 
    FOR DELETE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'committee_leader'))
    );

-- =============================================
-- Create storage bucket for course posters
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('course-posters', 'course-posters', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for course-posters bucket
DROP POLICY IF EXISTS "course_posters_public_read" ON storage.objects;
CREATE POLICY "course_posters_public_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'course-posters');

DROP POLICY IF EXISTS "course_posters_authenticated_insert" ON storage.objects;
CREATE POLICY "course_posters_authenticated_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'course-posters');

DROP POLICY IF EXISTS "course_posters_authenticated_update" ON storage.objects;
CREATE POLICY "course_posters_authenticated_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'course-posters');

DROP POLICY IF EXISTS "course_posters_authenticated_delete" ON storage.objects;
CREATE POLICY "course_posters_authenticated_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'course-posters');
