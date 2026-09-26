-- Allow assigned trainers and course creators to manage course beneficiaries
DROP POLICY IF EXISTS "Trainers and creators can manage course beneficiaries" ON public.course_beneficiaries;
CREATE POLICY "Trainers and creators can manage course beneficiaries" ON public.course_beneficiaries
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.courses c
            LEFT JOIN public.course_trainers ct ON ct.course_id = c.id
            LEFT JOIN public.trainers t ON (t.id = c.trainer_id OR t.id = ct.trainer_id)
            WHERE c.id = course_beneficiaries.course_id
            AND (c.created_by = auth.uid() OR t.user_id = auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.courses c
            LEFT JOIN public.course_trainers ct ON ct.course_id = c.id
            LEFT JOIN public.trainers t ON (t.id = c.trainer_id OR t.id = ct.trainer_id)
            WHERE c.id = course_beneficiaries.course_id
            AND (c.created_by = auth.uid() OR t.user_id = auth.uid())
        )
    );
