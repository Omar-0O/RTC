-- Add head_events to caravans RLS policies _
DROP POLICY IF EXISTS "Manage caravans for head_caravans and admin" ON public.caravans;
CREATE POLICY "Manage caravans for head_caravans and admin" ON public.caravans
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'head_caravans', 'supervisor', 'head_fourth_year', 'head_events')
        )
    );

DROP POLICY IF EXISTS "View caravan participants for authorized users" ON public.caravan_participants;
CREATE POLICY "View caravan participants for authorized users" ON public.caravan_participants
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'head_caravans', 'supervisor', 'head_fourth_year', 'head_events')
        )
    );

DROP POLICY IF EXISTS "Manage caravan participants for head_caravans and admin" ON public.caravan_participants;
CREATE POLICY "Manage caravan participants for head_caravans and admin" ON public.caravan_participants
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'head_caravans', 'supervisor', 'head_fourth_year', 'head_events')
        )
    );
