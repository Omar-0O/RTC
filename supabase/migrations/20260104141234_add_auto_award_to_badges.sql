-- Add auto_award field to badges table

ALTER TABLE public.badges 
ADD COLUMN auto_award BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.badges.auto_award IS 'If true, badge is automatically awarded when volunteer meets requirements';
