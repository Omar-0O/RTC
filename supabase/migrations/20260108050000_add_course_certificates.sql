-- Add certificate tracking columns to courses
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS has_certificates BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS certificate_status TEXT DEFAULT 'pending' CHECK (certificate_status IN ('pending', 'printing', 'ready', 'delivered'));

COMMENT ON COLUMN public.courses.has_certificates IS 'Whether this course includes certificates';
COMMENT ON COLUMN public.courses.certificate_status IS 'Status of certificate processing';
