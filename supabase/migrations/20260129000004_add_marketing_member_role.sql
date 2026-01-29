-- Add marketing_member to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketing_member';
