-- Add head_marketing and head_ashbal to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_marketing';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_ashbal';