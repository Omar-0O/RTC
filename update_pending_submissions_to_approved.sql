-- =============================================
-- Migration: Update all pending activity submissions to approved
-- Purpose: Convert all existing 'pending' participation entries to 'approved'
-- =============================================

UPDATE activity_submissions
SET status = 'approved'
WHERE status = 'pending';
