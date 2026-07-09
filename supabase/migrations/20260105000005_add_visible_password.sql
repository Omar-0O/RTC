-- Deprecated security migration.
--
-- This migration used to create reversible password storage. That design was
-- removed because application users must never be able to read plaintext or
-- recoverable passwords from database rows.
--
-- Keep this file as a no-op so existing migration history remains stable while
-- fresh local database resets do not create the unsafe schema even briefly.
SELECT 1;
