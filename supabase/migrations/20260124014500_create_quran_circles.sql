-- Create table for Quran Circles
CREATE TABLE public.quran_circles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    guest_names JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create junction table for beneficiaries attending a circle
CREATE TABLE public.quran_circle_beneficiaries (
    circle_id UUID REFERENCES public.quran_circles(id) ON DELETE CASCADE,
    beneficiary_id UUID REFERENCES public.quran_beneficiaries(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (circle_id, beneficiary_id)
);
