-- Migration: Allow authenticated users to insert and update beneficiaries
-- Reason: Organizers need to register students and update their details.

-- Drop the old restrictive policy that bundled INSERT/UPDATE/DELETE for admins only
DROP POLICY IF EXISTS "Allow write access for admin and head_quran" ON public.quran_beneficiaries;

-- 1. INSERT: Allow any authenticated user to add a beneficiary
-- This is required for organizers to add new students to the system.
CREATE POLICY "Allow insert for authenticated" ON public.quran_beneficiaries
FOR INSERT TO authenticated
WITH CHECK (true);

-- 2. UPDATE: Allow any authenticated user to update a beneficiary
-- This allows organizers to correct names, phones, etc.
CREATE POLICY "Allow update for authenticated" ON public.quran_beneficiaries
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- 3. DELETE: Keep delete restricted to admins and head_quran
-- We don't want organizers accidentally deleting students who might be in other circles.
CREATE POLICY "Allow delete for admin and head_quran" ON public.quran_beneficiaries
FOR DELETE TO authenticated
USING (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'head_quran')
);
