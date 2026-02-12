-- Add last_seen_at to profiles for online status tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Allow users to update their own last_seen_at
CREATE POLICY "Users can update own last_seen_at" ON public.profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
