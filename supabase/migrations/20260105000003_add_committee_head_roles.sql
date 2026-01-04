-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_production';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_fourth_year';
