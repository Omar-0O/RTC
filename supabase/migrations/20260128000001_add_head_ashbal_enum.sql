-- Add 'head_ashbal' to app_role enum
-- Run this ALONE and let it complete before running the policies.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_ashbal';
