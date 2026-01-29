-- Create fine_types table
CREATE TABLE IF NOT EXISTS public.fine_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    default_points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.fine_types ENABLE ROW LEVEL SECURITY;

-- Policies for fine_types
CREATE POLICY "Fine types are viewable by everyone" ON public.fine_types
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage fine types" ON public.fine_types
    FOR ALL
    USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'head_hr')
    );

-- Add fine_type_id to activity_submissions
ALTER TABLE public.activity_submissions 
ADD COLUMN IF NOT EXISTS fine_type_id UUID REFERENCES public.fine_types(id);
