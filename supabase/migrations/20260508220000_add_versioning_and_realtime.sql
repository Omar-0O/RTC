-- ============================================================================
-- Record Versioning — adds version tracking to critical tables.
--
-- Enables conflict detection: clients send their last known version,
-- server rejects if version has changed (optimistic concurrency control).
--
-- Fields added:
--   version    — incrementing integer, bumped on every update
--   updated_by — UUID of the user who last modified the record
-- ============================================================================

-- ── profiles ────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- updated_at already exists on profiles; ensure it auto-updates:
CREATE OR REPLACE FUNCTION public.bump_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_bump_version ON public.profiles;
CREATE TRIGGER trg_profiles_bump_version
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

-- ── users_followup ──────────────────────────────────────────────────
ALTER TABLE public.users_followup
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid;

DROP TRIGGER IF EXISTS trg_followup_bump_version ON public.users_followup;
CREATE TRIGGER trg_followup_bump_version
  BEFORE UPDATE ON public.users_followup
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

-- ── quran_circles ───────────────────────────────────────────────────
ALTER TABLE public.quran_circles
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

DROP TRIGGER IF EXISTS trg_circles_bump_version ON public.quran_circles;
CREATE TRIGGER trg_circles_bump_version
  BEFORE UPDATE ON public.quran_circles
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

-- ── activity_submissions ────────────────────────────────────────────
ALTER TABLE public.activity_submissions
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

DROP TRIGGER IF EXISTS trg_submissions_bump_version ON public.activity_submissions;
CREATE TRIGGER trg_submissions_bump_version
  BEFORE UPDATE ON public.activity_submissions
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

-- ============================================================================
-- Optimistic Concurrency Check Function
--
-- Usage: SELECT check_version('profiles', 'some-uuid', 3);
-- Returns TRUE if current version matches, FALSE if stale.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_version(
  table_name text,
  record_id text,
  expected_version integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_ver integer;
BEGIN
  EXECUTE format('SELECT version FROM public.%I WHERE id = $1', table_name)
    INTO current_ver
    USING record_id;

  IF current_ver IS NULL THEN
    RETURN TRUE; -- Record doesn't exist or has no version
  END IF;

  RETURN current_ver = expected_version;
END;
$$;

-- ============================================================================
-- Enable Supabase Realtime on critical tables (safe — skips if already added)
-- ============================================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['profiles', 'users_followup', 'quran_circles', 'activity_submissions']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      RAISE NOTICE 'Added % to supabase_realtime', tbl;
    ELSE
      RAISE NOTICE '% already in supabase_realtime, skipping', tbl;
    END IF;
  END LOOP;
END;
$$;
