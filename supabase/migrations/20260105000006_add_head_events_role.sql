-- Add head_events to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_events';
