ALTER TABLE quran_teachers ADD COLUMN IF NOT EXISTS specialization text;
ALTER TABLE quran_teachers ADD COLUMN IF NOT EXISTS teaching_mode text DEFAULT 'both';
ALTER TABLE quran_teachers ADD COLUMN IF NOT EXISTS target_gender text DEFAULT 'men';
NOTIFY pgrst, 'reload config';
