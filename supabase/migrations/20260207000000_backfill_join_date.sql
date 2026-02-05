-- Migration to backfill join_date for existing users
-- This ensures that users who were created before the join_date column was actively used
-- will have a valid date (their account creation date) instead of null.
-- This also helps prevent frontend issues where join_date might be expected.

UPDATE profiles
SET join_date = created_at
WHERE join_date IS NULL;
