-- Add head_quran to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_quran';

-- Create quran_beneficiaries table
CREATE TABLE IF NOT EXISTS public.quran_beneficiaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT,
    phone TEXT NOT NULL,
    image_url TEXT,
    previous_parts INTEGER NOT NULL DEFAULT 0, -- Measured in quarters (rub')
    current_parts INTEGER NOT NULL DEFAULT 0, -- Measured in quarters (rub')
    date_added DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.quran_beneficiaries ENABLE ROW LEVEL SECURITY;

-- Policies are created in the following migration, after head_quran commits.
