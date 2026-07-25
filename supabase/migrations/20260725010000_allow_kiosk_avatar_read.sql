-- Allow anonymous (kiosk) users to read avatars
-- The kiosk displays volunteer avatars without authentication

DROP POLICY IF EXISTS "avatars_select_anon" ON storage.objects;

CREATE POLICY "avatars_select_anon"
ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'avatars');
