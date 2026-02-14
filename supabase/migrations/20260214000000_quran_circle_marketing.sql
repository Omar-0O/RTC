-- Quran Circle Marketing Section Migration
-- Add tables for quran circle ads (marketing) and quran circle marketers

-- =============================================
-- Quran Circle Ads table - stores marketing ads for each quran circle
-- =============================================
CREATE TABLE IF NOT EXISTS quran_circle_ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    circle_id UUID REFERENCES quran_circles(id) ON DELETE CASCADE NOT NULL,
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
    UNIQUE(circle_id, ad_number)
);

-- =============================================
-- Quran Circle Marketers table - tracks which volunteers are assigned as marketers
-- =============================================
CREATE TABLE IF NOT EXISTS quran_circle_marketers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    circle_id UUID REFERENCES quran_circles(id) ON DELETE CASCADE NOT NULL,
    volunteer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(circle_id, volunteer_id)
);

-- =============================================
-- Indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_quran_circle_ads_circle_id ON quran_circle_ads(circle_id);
CREATE INDEX IF NOT EXISTS idx_quran_circle_marketers_circle_id ON quran_circle_marketers(circle_id);
CREATE INDEX IF NOT EXISTS idx_quran_circle_marketers_volunteer_id ON quran_circle_marketers(volunteer_id);

-- =============================================
-- Enable Row Level Security
-- =============================================
ALTER TABLE quran_circle_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE quran_circle_marketers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies for quran_circle_ads
-- =============================================

-- Allow all authenticated users to read ads
DROP POLICY IF EXISTS "quran_circle_ads_select" ON quran_circle_ads;
CREATE POLICY "quran_circle_ads_select" ON quran_circle_ads 
    FOR SELECT TO authenticated 
    USING (true);

-- Allow marketers and admins/head_quran to insert ads
DROP POLICY IF EXISTS "quran_circle_ads_insert" ON quran_circle_ads;
CREATE POLICY "quran_circle_ads_insert" ON quran_circle_ads 
    FOR INSERT TO authenticated 
    WITH CHECK (
        EXISTS (SELECT 1 FROM quran_circle_marketers WHERE circle_id = quran_circle_ads.circle_id AND volunteer_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'head_quran'))
    );

-- Allow marketers and admins/head_quran to update ads
DROP POLICY IF EXISTS "quran_circle_ads_update" ON quran_circle_ads;
CREATE POLICY "quran_circle_ads_update" ON quran_circle_ads 
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM quran_circle_marketers WHERE circle_id = quran_circle_ads.circle_id AND volunteer_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'head_quran'))
    );

-- Allow admins/head_quran to delete ads
DROP POLICY IF EXISTS "quran_circle_ads_delete" ON quran_circle_ads;
CREATE POLICY "quran_circle_ads_delete" ON quran_circle_ads 
    FOR DELETE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'head_quran'))
    );

-- =============================================
-- RLS Policies for quran_circle_marketers
-- =============================================

-- Allow all authenticated users to read marketers
DROP POLICY IF EXISTS "quran_circle_marketers_select" ON quran_circle_marketers;
CREATE POLICY "quran_circle_marketers_select" ON quran_circle_marketers 
    FOR SELECT TO authenticated 
    USING (true);

-- Allow admins/head_quran to manage marketers
DROP POLICY IF EXISTS "quran_circle_marketers_insert" ON quran_circle_marketers;
CREATE POLICY "quran_circle_marketers_insert" ON quran_circle_marketers 
    FOR INSERT TO authenticated 
    WITH CHECK (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'head_quran'))
    );

DROP POLICY IF EXISTS "quran_circle_marketers_delete" ON quran_circle_marketers;
CREATE POLICY "quran_circle_marketers_delete" ON quran_circle_marketers 
    FOR DELETE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'head_quran'))
    );

-- =============================================
-- Create storage bucket for quran circle posters
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('quran-circle-posters', 'quran-circle-posters', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for quran-circle-posters bucket
DROP POLICY IF EXISTS "quran_circle_posters_public_read" ON storage.objects;
CREATE POLICY "quran_circle_posters_public_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'quran-circle-posters');

DROP POLICY IF EXISTS "quran_circle_posters_authenticated_insert" ON storage.objects;
CREATE POLICY "quran_circle_posters_authenticated_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'quran-circle-posters');

DROP POLICY IF EXISTS "quran_circle_posters_authenticated_update" ON storage.objects;
CREATE POLICY "quran_circle_posters_authenticated_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'quran-circle-posters');

DROP POLICY IF EXISTS "quran_circle_posters_authenticated_delete" ON storage.objects;
CREATE POLICY "quran_circle_posters_authenticated_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'quran-circle-posters');
