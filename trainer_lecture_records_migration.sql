-- =============================================
-- Migration: trainer_lecture_records
-- Purpose: Track trainer participation per lecture
--          Works for both internal volunteers and external trainers
--          volunteer_id is nullable → no profile required
-- =============================================

CREATE TABLE IF NOT EXISTS trainer_lecture_records (
    id          uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id   uuid            REFERENCES courses(id) ON DELETE CASCADE,
    lecture_id  uuid            REFERENCES course_lectures(id) ON DELETE CASCADE,
    trainer_name text           NOT NULL,
    trainer_phone text,
    volunteer_id  uuid          REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  timestamptz     DEFAULT now()
);

-- Index for fast lookup by course/lecture
CREATE INDEX IF NOT EXISTS idx_tlr_course    ON trainer_lecture_records(course_id);
CREATE INDEX IF NOT EXISTS idx_tlr_lecture   ON trainer_lecture_records(lecture_id);
CREATE INDEX IF NOT EXISTS idx_tlr_volunteer ON trainer_lecture_records(volunteer_id);

-- RLS
ALTER TABLE trainer_lecture_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_tlr"
    ON trainer_lecture_records FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "authenticated_insert_tlr"
    ON trainer_lecture_records FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_delete_tlr"
    ON trainer_lecture_records FOR DELETE
    TO authenticated USING (true);
