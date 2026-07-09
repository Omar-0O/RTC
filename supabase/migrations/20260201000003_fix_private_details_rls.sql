-- Deprecated security migration.
--
-- user_private_details stored recoverable passwords and has been removed.
-- Keep this migration as a no-op so historical migration order remains stable
-- without recreating or granting access to unsafe password storage.
SELECT 1;
