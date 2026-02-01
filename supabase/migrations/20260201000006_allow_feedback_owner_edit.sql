-- Allow authors to update and delete their own feedbacks

-- 1. Policy for UPDATE
DROP POLICY IF EXISTS "Authors can update own feedbacks" ON public.volunteer_feedbacks;
CREATE POLICY "Authors can update own feedbacks" ON public.volunteer_feedbacks
    FOR UPDATE USING (auth.uid() = author_id);

-- 2. Policy for DELETE
DROP POLICY IF EXISTS "Authors can delete own feedbacks" ON public.volunteer_feedbacks;
CREATE POLICY "Authors can delete own feedbacks" ON public.volunteer_feedbacks
    FOR DELETE USING (auth.uid() = author_id);
