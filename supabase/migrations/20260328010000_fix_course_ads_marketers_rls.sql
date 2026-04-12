-- Fix RLS for course_ads and course_marketers to robustly check for head_marketing

-- 1. Course Ads Policies
DROP POLICY IF EXISTS "course_ads_insert" ON public.course_ads;
CREATE POLICY "course_ads_insert" ON public.course_ads 
    FOR INSERT TO authenticated 
    WITH CHECK (
        EXISTS (SELECT 1 FROM course_marketers WHERE course_id = course_ads.course_id AND volunteer_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'committee_leader')
        OR public.has_role(auth.uid(), 'head_marketing')
        OR public.has_role(auth.uid(), 'head_hr')
    );

DROP POLICY IF EXISTS "course_ads_update" ON public.course_ads;
CREATE POLICY "course_ads_update" ON public.course_ads 
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM course_marketers WHERE course_id = course_ads.course_id AND volunteer_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'committee_leader')
        OR public.has_role(auth.uid(), 'head_marketing')
        OR public.has_role(auth.uid(), 'head_hr')
    );

DROP POLICY IF EXISTS "course_ads_delete" ON public.course_ads;
CREATE POLICY "course_ads_delete" ON public.course_ads 
    FOR DELETE TO authenticated 
    USING (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'head_marketing')
        OR public.has_role(auth.uid(), 'head_hr')
    );

-- 2. Course Marketers Policies
DROP POLICY IF EXISTS "course_marketers_insert" ON public.course_marketers;
CREATE POLICY "course_marketers_insert" ON public.course_marketers 
    FOR INSERT TO authenticated 
    WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'committee_leader')
        OR public.has_role(auth.uid(), 'head_marketing')
        OR public.has_role(auth.uid(), 'head_hr')
    );

DROP POLICY IF EXISTS "course_marketers_delete" ON public.course_marketers;
CREATE POLICY "course_marketers_delete" ON public.course_marketers 
    FOR DELETE TO authenticated 
    USING (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'committee_leader')
        OR public.has_role(auth.uid(), 'head_marketing')
        OR public.has_role(auth.uid(), 'head_hr')
    );
