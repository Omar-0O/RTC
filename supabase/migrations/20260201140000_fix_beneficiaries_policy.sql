-- Allow authenticated users to view quran beneficiaries to take attendance
ALTER TABLE public.quran_beneficiaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated" ON public.quran_beneficiaries;

CREATE POLICY "Allow read access for authenticated" ON public.quran_beneficiaries
FOR SELECT TO authenticated USING (true);
