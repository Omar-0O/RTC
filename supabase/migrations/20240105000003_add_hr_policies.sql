-- The required tables and has_role function are created by the later baseline
-- migration. Policies are replayed after that baseline exists.
DO $$
BEGIN
  RAISE NOTICE 'Deferring legacy HR policies until the baseline schema is available.';
END;
$$;
