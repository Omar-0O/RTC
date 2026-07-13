-- PostgreSQL enum values cannot be used until the migration that adds them
-- commits. This follows 20260124000000_add_head_quran_role.sql.

DROP POLICY IF EXISTS "Allow read access for admin and head_quran" ON public.quran_beneficiaries;
DROP POLICY IF EXISTS "Allow write access for admin and head_quran" ON public.quran_beneficiaries;

CREATE POLICY "Allow read access for admin and head_quran"
ON public.quran_beneficiaries
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'head_quran')
);

CREATE POLICY "Allow write access for admin and head_quran"
ON public.quran_beneficiaries
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'head_quran')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'head_quran')
);
