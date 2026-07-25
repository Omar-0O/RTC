-- Migration: Unify leadership RLS policies across all domain modules
-- Date: 2026-07-26
-- Reason: Ensure all committee heads, committee leaders, branch admins, and executives
-- have appropriate permissions across fines, trainers, caravans, events, ethics, and submissions.

-- 1. Volunteer Fines Policies
DROP POLICY IF EXISTS "Privileged users can view all fines" ON public.volunteer_fines;
CREATE POLICY "Privileged users can view all fines" ON public.volunteer_fines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'head_hr', 'hr', 'committee_leader', 'head_production',
                'head_fourth_year', 'head_events', 'head_caravans',
                'head_ethics', 'head_quran', 'head_marketing', 'head_ashbal'
            )
        )
        OR volunteer_id = auth.uid()
    );

DROP POLICY IF EXISTS "Privileged users can create fines" ON public.volunteer_fines;
CREATE POLICY "Privileged users can create fines" ON public.volunteer_fines
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'head_hr', 'hr', 'committee_leader', 'head_production',
                'head_fourth_year', 'head_events', 'head_caravans',
                'head_ethics', 'head_quran', 'head_marketing', 'head_ashbal'
            )
        )
    );

DROP POLICY IF EXISTS "Privileged users can delete fines" ON public.volunteer_fines;
CREATE POLICY "Privileged users can delete fines" ON public.volunteer_fines
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'head_hr', 'hr', 'committee_leader', 'head_production',
                'head_fourth_year', 'head_events', 'head_caravans',
                'head_ethics', 'head_quran', 'head_marketing', 'head_ashbal'
            )
        )
    );

DROP POLICY IF EXISTS "Privileged users can update fines" ON public.volunteer_fines;
CREATE POLICY "Privileged users can update fines" ON public.volunteer_fines
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'head_hr', 'hr', 'committee_leader', 'head_production',
                'head_fourth_year', 'head_events', 'head_caravans',
                'head_ethics', 'head_quran', 'head_marketing', 'head_ashbal'
            )
        )
    );

-- 2. Trainers Table Policies
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trainers') THEN
    DROP POLICY IF EXISTS "Manage trainers for heads" ON public.trainers;
    CREATE POLICY "Manage trainers for heads" ON public.trainers
        FOR ALL USING (
            auth.uid() IN (
                SELECT user_id FROM user_roles 
                WHERE role IN (
                    'admin', 'executive', 'branch_admin', 'supervisor',
                    'committee_leader', 'head_production', 'head_fourth_year',
                    'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                    'head_marketing', 'head_ashbal', 'head_hr'
                )
            )
        );
END IF;
END $$;

-- 3. Caravans Table Policies
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'caravans') THEN
    DROP POLICY IF EXISTS "Manage caravans for heads" ON public.caravans;
    CREATE POLICY "Manage caravans for heads" ON public.caravans
        FOR ALL USING (
            auth.uid() IN (
                SELECT user_id FROM user_roles 
                WHERE role IN (
                    'admin', 'executive', 'branch_admin', 'supervisor',
                    'committee_leader', 'head_caravans', 'head_events',
                    'head_production', 'head_fourth_year', 'head_ethics',
                    'head_quran', 'head_marketing', 'head_ashbal', 'head_hr'
                )
            )
        );
END IF;
END $$;

DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'caravan_participants') THEN
    DROP POLICY IF EXISTS "Manage caravan participants for heads" ON public.caravan_participants;
    CREATE POLICY "Manage caravan participants for heads" ON public.caravan_participants
        FOR ALL USING (
            auth.uid() IN (
                SELECT user_id FROM user_roles 
                WHERE role IN (
                    'admin', 'executive', 'branch_admin', 'supervisor',
                    'committee_leader', 'head_caravans', 'head_events',
                    'head_production', 'head_fourth_year', 'head_ethics',
                    'head_quran', 'head_marketing', 'head_ashbal', 'head_hr'
                )
            )
        );
END IF;
END $$;

-- 4. Events Table Policies
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    DROP POLICY IF EXISTS "Manage events for heads" ON public.events;
    CREATE POLICY "Manage events for heads" ON public.events
        FOR ALL USING (
            auth.uid() IN (
                SELECT user_id FROM user_roles 
                WHERE role IN (
                    'admin', 'executive', 'branch_admin', 'supervisor',
                    'committee_leader', 'head_events', 'head_caravans',
                    'head_production', 'head_fourth_year', 'head_ethics',
                    'head_quran', 'head_marketing', 'head_ashbal', 'head_hr'
                )
            )
        );
END IF;
END $$;

DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_participants') THEN
    DROP POLICY IF EXISTS "Manage event participants for heads" ON public.event_participants;
    CREATE POLICY "Manage event participants for heads" ON public.event_participants
        FOR ALL USING (
            auth.uid() IN (
                SELECT user_id FROM user_roles 
                WHERE role IN (
                    'admin', 'executive', 'branch_admin', 'supervisor',
                    'committee_leader', 'head_events', 'head_caravans',
                    'head_production', 'head_fourth_year', 'head_ethics',
                    'head_quran', 'head_marketing', 'head_ashbal', 'head_hr'
                )
            )
        );
END IF;
END $$;

DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_beneficiaries') THEN
    DROP POLICY IF EXISTS "Manage event beneficiaries for heads" ON public.event_beneficiaries;
    CREATE POLICY "Manage event beneficiaries for heads" ON public.event_beneficiaries
        FOR ALL USING (
            auth.uid() IN (
                SELECT user_id FROM user_roles 
                WHERE role IN (
                    'admin', 'executive', 'branch_admin', 'supervisor',
                    'committee_leader', 'head_events', 'head_caravans',
                    'head_production', 'head_fourth_year', 'head_ethics',
                    'head_quran', 'head_marketing', 'head_ashbal', 'head_hr'
                )
            )
        );
END IF;
END $$;

DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_organizers') THEN
    DROP POLICY IF EXISTS "Manage event organizers for heads" ON public.event_organizers;
    CREATE POLICY "Manage event organizers for heads" ON public.event_organizers
        FOR ALL USING (
            auth.uid() IN (
                SELECT user_id FROM user_roles 
                WHERE role IN (
                    'admin', 'executive', 'branch_admin', 'supervisor',
                    'committee_leader', 'head_events', 'head_caravans',
                    'head_production', 'head_fourth_year', 'head_ethics',
                    'head_quran', 'head_marketing', 'head_ashbal', 'head_hr'
                )
            )
        );
END IF;
END $$;

-- 5. Ethics Tables Policies
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'competition_participants') THEN
    DROP POLICY IF EXISTS "Manage competition_participants for heads" ON public.competition_participants;
    CREATE POLICY "Manage competition_participants for heads" ON public.competition_participants
        FOR ALL USING (
            auth.uid() IN (
                SELECT user_id FROM user_roles 
                WHERE role IN (
                    'admin', 'executive', 'branch_admin', 'supervisor',
                    'committee_leader', 'head_ethics', 'head_hr'
                )
            )
        );
END IF;
END $$;

DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'competition_entries') THEN
    DROP POLICY IF EXISTS "Manage competition_entries for heads" ON public.competition_entries;
    CREATE POLICY "Manage competition_entries for heads" ON public.competition_entries
        FOR ALL USING (
            auth.uid() IN (
                SELECT user_id FROM user_roles 
                WHERE role IN (
                    'admin', 'executive', 'branch_admin', 'supervisor',
                    'committee_leader', 'head_ethics', 'head_hr'
                )
            )
        );
END IF;
END $$;

DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ethics_calls') THEN
    DROP POLICY IF EXISTS "Manage ethics calls for ethics head" ON public.ethics_calls;
    CREATE POLICY "Manage ethics calls for ethics head" ON public.ethics_calls
        FOR ALL USING (
            auth.uid() IN (
                SELECT user_id FROM user_roles 
                WHERE role IN (
                    'admin', 'executive', 'branch_admin', 'supervisor',
                    'committee_leader', 'head_ethics'
                )
            )
        );
END IF;
END $$;

-- 6. Form Submissions Delete Policy
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'form_submissions') THEN
    DROP POLICY IF EXISTS "Allow privileged users to delete submissions" ON public.form_submissions;
    CREATE POLICY "Allow privileged users to delete submissions" ON public.form_submissions
        FOR DELETE USING (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'executive', 'branch_admin', 'supervisor', 'head_hr', 'hr')
            )
        );
END IF;
END $$;
