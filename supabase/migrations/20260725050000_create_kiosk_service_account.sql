-- Create a dedicated kiosk service account so the Kiosk terminal can operate
-- as an authenticated user without requiring manual login.
-- This replaces the fragile anon-based approach.

DO $$
DECLARE
  _uid uuid;
BEGIN
  -- Check if the kiosk user already exists with either email
  SELECT id INTO _uid FROM auth.users WHERE email = 'Medaniparticipations@rtc.org' OR email = 'kiosk@rtc.internal';

  IF _uid IS NULL THEN
    _uid := gen_random_uuid();

    -- 1. Create auth user
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, role, aud,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token
    ) VALUES (
      _uid,
      '00000000-0000-0000-0000-000000000000',
      'Medaniparticipations@rtc.org',
      crypt('Medani', gen_salt('bf')),
      now(),
      'authenticated',
      'authenticated',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Kiosk Terminal"}'::jsonb,
      now(), now(), ''
    );

    -- 2. Create identity record (required for Supabase GoTrue v2+)
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      _uid, _uid,
      jsonb_build_object('sub', _uid::text, 'email', 'Medaniparticipations@rtc.org'),
      'email', _uid::text,
      now(), now(), now()
    );

    -- 3. Create profile
    INSERT INTO public.profiles (id, email, full_name, full_name_ar, phone, level, branch_id, is_active)
    VALUES (
      _uid,
      'Medaniparticipations@rtc.org',
      'Kiosk Terminal',
      'تسجيل المشاركات الميداني',
      '+200000000000',
      'responsible',
      get_default_branch_id(),
      false  -- Mark inactive so it doesn't appear in volunteer lists/leaderboards
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      full_name_ar = EXCLUDED.full_name_ar,
      is_active = EXCLUDED.is_active;

    RAISE NOTICE 'Kiosk service account created with id: %', _uid;
  ELSE
    -- Update existing user credentials and email
    UPDATE auth.users 
    SET email = 'Medaniparticipations@rtc.org',
        encrypted_password = crypt('Medani', gen_salt('bf')),
        updated_at = now()
    WHERE id = _uid;

    UPDATE public.profiles
    SET email = 'Medaniparticipations@rtc.org',
        full_name_ar = 'تسجيل المشاركات الميداني'
    WHERE id = _uid;

    RAISE NOTICE 'Kiosk service account updated for email Medaniparticipations@rtc.org';
  END IF;
END;
$$;
