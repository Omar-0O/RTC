-- 1. Update deprecated roles to 'volunteer' ONLY for users who DO NOT already have the 'volunteer' role
UPDATE public.user_roles
SET role = 'volunteer'
WHERE role IN ('head_production', 'head_fourth_year')
AND user_id NOT IN (
    SELECT user_id FROM public.user_roles WHERE role = 'volunteer'
);

-- 2. Delete the remaining deprecated roles. 
-- These belong to users who ALREADY had 'volunteer' (so the UPDATE above didn't touch them),
-- meaning we can safely just remove the deprecated role without leaving them role-less.
DELETE FROM public.user_roles
WHERE role IN ('head_production', 'head_fourth_year');

-- 3. (Removed) UPDATE public.profiles - 'role' column does not exist there.
