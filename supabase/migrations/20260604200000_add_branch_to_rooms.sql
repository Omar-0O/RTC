-- ============================================================================
-- MIGRATION: Add branch_id to public.rooms table
-- ============================================================================

-- 1. Add branch_id column to rooms table referencing branches(id)
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

-- 2. Update existing rooms to the default branch (Mohandeseen)
UPDATE public.rooms 
SET branch_id = public.get_default_branch_id()
WHERE branch_id IS NULL;

-- 3. Set branch_id column to NOT NULL and configure default
ALTER TABLE public.rooms 
ALTER COLUMN branch_id SET NOT NULL,
ALTER COLUMN branch_id SET DEFAULT public.get_default_branch_id();

-- 4. Re-enable Row Level Security with Branch Filtering
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- 5. Drop old policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.rooms;
DROP POLICY IF EXISTS "Enable insert for admins" ON public.rooms;
DROP POLICY IF EXISTS "Enable update for admins" ON public.rooms;
DROP POLICY IF EXISTS "Enable delete for admins" ON public.rooms;
DROP POLICY IF EXISTS "rooms_select" ON public.rooms;
DROP POLICY IF EXISTS "rooms_insert" ON public.rooms;
DROP POLICY IF EXISTS "rooms_update" ON public.rooms;
DROP POLICY IF EXISTS "rooms_delete" ON public.rooms;

-- 6. Create branch-aware RLS policies
-- READ: Users can read rooms if they are admin/executive OR if the room is in their branch
CREATE POLICY "rooms_select" ON public.rooms
    FOR SELECT TO authenticated
    USING (
        public.is_admin_or_exec() 
        OR branch_id = public.get_my_branch_id()
    );

-- WRITE (INSERT/UPDATE/DELETE): Admin/Executive can manage all, branch_admin can manage rooms in their branch
CREATE POLICY "rooms_insert" ON public.rooms
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin_or_exec() 
        OR (
            public.is_branch_admin() 
            AND branch_id = public.get_my_branch_id()
        )
    );

CREATE POLICY "rooms_update" ON public.rooms
    FOR UPDATE TO authenticated
    USING (
        public.is_admin_or_exec() 
        OR (
            public.is_branch_admin() 
            AND branch_id = public.get_my_branch_id()
        )
    )
    WITH CHECK (
        public.is_admin_or_exec() 
        OR (
            public.is_branch_admin() 
            AND branch_id = public.get_my_branch_id()
        )
    );

CREATE POLICY "rooms_delete" ON public.rooms
    FOR DELETE TO authenticated
    USING (
        public.is_admin_or_exec() 
        OR (
            public.is_branch_admin() 
            AND branch_id = public.get_my_branch_id()
        )
    );
