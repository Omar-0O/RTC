-- Create storage bucket for activity proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('activity-proofs', 'activity-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own proofs
DROP POLICY IF EXISTS "Users can upload their own proofs" ON storage.objects;
CREATE POLICY "Users can upload their own proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'activity-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own proofs
DROP POLICY IF EXISTS "Users can update their own proofs" ON storage.objects;
CREATE POLICY "Users can update their own proofs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'activity-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to all proofs
DROP POLICY IF EXISTS "Proofs are publicly accessible" ON storage.objects;
CREATE POLICY "Proofs are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'activity-proofs');

-- Allow users to delete their own proofs
DROP POLICY IF EXISTS "Users can delete their own proofs" ON storage.objects;
CREATE POLICY "Users can delete their own proofs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'activity-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admins to upload proofs for any user (if needed)
DROP POLICY IF EXISTS "Admins can upload any proof" ON storage.objects;
CREATE POLICY "Admins can upload any proof"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'activity-proofs' 
  AND public.has_role(auth.uid(), 'admin')
);
