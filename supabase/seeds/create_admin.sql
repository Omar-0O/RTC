-- Enable pgcrypto for password hashing
create extension if not exists "pgcrypto";

-- Set variables for the new user
do $$
declare
  new_user_id uuid := gen_random_uuid();
  user_email text := 'rtc@gmail.com';
  user_password text := 'admin321';
  user_name text := 'RTC Admin';
begin
  -- 1. Insert into auth.users
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    user_email,
    crypt(user_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', user_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- 2. Insert into public.profiles (if not handled by trigger)
  -- Note: If you have a trigger on auth.users that creates a profile, this might fail or duplicate.
  -- We'll use ON CONFLICT to be safe.
  insert into public.profiles (id, email, full_name, total_points, activities_count, join_date, level)
  values (
    new_user_id,
    user_email,
    user_name,
    0,
    0,
    now(),
    'bronze'
  )
  on conflict (id) do update
  set 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

  -- 3. Insert into public.user_roles
  insert into public.user_roles (user_id, role)
  values (new_user_id, 'admin')
  on conflict (user_id, role) do nothing;

  raise notice 'Admin user created successfully. ID: %', new_user_id;

exception when unique_violation then
  raise notice 'User with email % already exists.', user_email;
end $$;
