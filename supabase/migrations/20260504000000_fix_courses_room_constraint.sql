-- Drop the hardcoded constraint on courses room and add foreign key to rooms table
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_room_check;

-- Optional: If the room column is currently TEXT, we can cast it or leave it as TEXT and just let the app handle the UUIDs.
-- The app saves UUIDs into this TEXT column now. It's better to add a foreign key constraint if possible.
-- Since the existing data might have 'lab_1', we probably shouldn't add a strict UUID foreign key yet unless we migrate old data.
-- So just dropping the check constraint is enough to fix the 400 Bad Request error.
