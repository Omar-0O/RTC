-- Quran Circles Redesign Migration
-- Changes: circles are now recurring definitions with organizer, sessions track individual sessions

-- Step 1: Create sessions table first (before modifying circles)
CREATE TABLE IF NOT EXISTS public.quran_circle_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL,
    session_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Migrate existing circle data to sessions
-- Each existing circle becomes a session linked to a new circle definition
INSERT INTO quran_circle_sessions (id, circle_id, session_date, notes, created_at)
SELECT id, id, date, name, created_at FROM quran_circles;

-- Step 3: Add new columns to quran_circles
ALTER TABLE public.quran_circles
ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Step 4: Add session_id to beneficiaries table
ALTER TABLE public.quran_circle_beneficiaries
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.quran_circle_sessions(id) ON DELETE CASCADE;

-- Step 5: Update existing beneficiary records to point to sessions
UPDATE public.quran_circle_beneficiaries bcb
SET session_id = bcb.circle_id
WHERE session_id IS NULL;

-- Step 6: Add foreign key from sessions to circles
ALTER TABLE public.quran_circle_sessions
ADD CONSTRAINT fk_session_circle FOREIGN KEY (circle_id) REFERENCES public.quran_circles(id) ON DELETE CASCADE;

-- Step 7: Enable RLS on sessions table
ALTER TABLE public.quran_circle_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
CREATE POLICY "Allow read access for authenticated" ON public.quran_circle_sessions
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write access for admin and head_quran" ON public.quran_circle_sessions
FOR ALL TO authenticated
USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'head_quran'))
WITH CHECK ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'head_quran'));

-- Allow organizers to manage their own circle sessions
CREATE POLICY "Allow organizer to manage sessions" ON public.quran_circle_sessions
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quran_circles 
        WHERE id = circle_id AND organizer_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.quran_circles 
        WHERE id = circle_id AND organizer_id = auth.uid()
    )
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_circle_id ON public.quran_circle_sessions(circle_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.quran_circle_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_session_id ON public.quran_circle_beneficiaries(session_id);
