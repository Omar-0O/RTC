-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('trainers', 'trainers', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

-- Policy: Allow public read for trainers bucket
CREATE POLICY "Public Read Trainers"
ON storage.objects FOR SELECT
USING ( bucket_id = 'trainers' );

-- Policy: Allow authenticated insert for trainers bucket
CREATE POLICY "Authenticated Insert Trainers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'trainers' );

-- Policy: Allow authenticated update for trainers bucket
CREATE POLICY "Authenticated Update Trainers"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'trainers' );

-- Policy: Allow authenticated delete for trainers bucket
CREATE POLICY "Authenticated Delete Trainers"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'trainers' );
