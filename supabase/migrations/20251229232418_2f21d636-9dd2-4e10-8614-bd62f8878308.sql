-- Create storage bucket for activity proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('activity-proofs', 'activity-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload their own proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'activity-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to all proofs
CREATE POLICY "Proofs are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'activity-proofs');

-- Allow users to delete their own proofs
CREATE POLICY "Users can delete their own proofs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'activity-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);