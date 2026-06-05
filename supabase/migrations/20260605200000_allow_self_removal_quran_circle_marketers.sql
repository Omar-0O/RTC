-- Migration: Allow Quran circle marketers and organizers to delete/leave their own records

-- 1. Quran Circle Marketers
DROP POLICY IF EXISTS "quran_circle_marketers_delete" ON public.quran_circle_marketers;
CREATE POLICY "quran_circle_marketers_delete" ON public.quran_circle_marketers 
    FOR DELETE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'head_quran'))
        OR volunteer_id = auth.uid()
    );

-- 2. Quran Circle Organizers
DROP POLICY IF EXISTS "Allow write for admin and head_quran" ON public.quran_circle_organizers;

DROP POLICY IF EXISTS "Allow insert/update for admin and head_quran" ON public.quran_circle_organizers;
CREATE POLICY "Allow insert/update for admin and head_quran" ON public.quran_circle_organizers
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'head_quran'))
    );

DROP POLICY IF EXISTS "Allow update for admin and head_quran" ON public.quran_circle_organizers;
CREATE POLICY "Allow update for admin and head_quran" ON public.quran_circle_organizers
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'head_quran'))
    );

DROP POLICY IF EXISTS "quran_circle_organizers_delete" ON public.quran_circle_organizers;
CREATE POLICY "quran_circle_organizers_delete" ON public.quran_circle_organizers
    FOR DELETE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'head_quran'))
        OR volunteer_id = auth.uid()
    );
