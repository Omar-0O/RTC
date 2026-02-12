-- Fix group_submissions RLS to allow committee heads to create submissions for their specific committees
-- regardless of their profile.committee_id

DROP POLICY IF EXISTS "Privileged users can create group submissions" ON public.group_submissions;

CREATE POLICY "Privileged users can create group submissions"
ON public.group_submissions
FOR INSERT
WITH CHECK (
  -- 1. Admin, Supervisor, Head HR can create for ANY committee
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor', 'head_hr')
  )
  OR
  -- 2. Specific Committee Heads for their committees
  (
    -- Head Caravans -> Caravans
    (
      public.has_role(auth.uid(), 'head_caravans') AND
      committee_id IN (SELECT id FROM public.committees WHERE name = 'Caravans')
    )
    OR
    -- Head Events -> Events
    (
      public.has_role(auth.uid(), 'head_events') AND
      committee_id IN (SELECT id FROM public.committees WHERE name = 'Events')
    )
    OR
    -- Head Ethics -> Ethics
    (
      public.has_role(auth.uid(), 'head_ethics') AND
      committee_id IN (SELECT id FROM public.committees WHERE name = 'Ethics')
    )
    OR
    -- Head Quran -> Quran
    (
      public.has_role(auth.uid(), 'head_quran') AND
      committee_id IN (SELECT id FROM public.committees WHERE name = 'Quran')
    )
    OR
    -- Head Ashbal -> Ashbal
    (
      public.has_role(auth.uid(), 'head_ashbal') AND
      committee_id IN (SELECT id FROM public.committees WHERE name = 'Ashbal')
    )
    OR
    -- Head Marketing -> Marketing
    (
      public.has_role(auth.uid(), 'head_marketing') AND
      committee_id IN (SELECT id FROM public.committees WHERE name = 'Marketing')
    )
     OR
    -- Head Media -> Media (Handling both just in case, though usually mapped to Marketing or Media)
    (
      public.has_role(auth.uid(), 'head_media') AND
      committee_id IN (SELECT id FROM public.committees WHERE name IN ('Media', 'Marketing'))
    )
    OR
    -- 3. Generic Committee Leader (must match profile committee)
    (
      public.has_role(auth.uid(), 'committee_leader') AND
      committee_id = public.get_user_committee_id(auth.uid())
    )
  )
);

-- Update activity_submissions RLS as well to match
DROP POLICY IF EXISTS "Committee leaders can create submissions for their committee" ON public.activity_submissions;

CREATE POLICY "Committee leaders can create submissions for their committee"
ON public.activity_submissions
FOR INSERT
WITH CHECK (
  -- 1. Admin, Supervisor, Head HR can create for ANY committee
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor', 'head_hr')
  )
  OR
  -- 2. Specific Committee Heads for their committees
  (
    (
      public.has_role(auth.uid(), 'head_caravans') AND
      committee_id IN (SELECT id FROM public.committees WHERE name = 'Caravans')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_events') AND
      committee_id IN (SELECT id FROM public.committees WHERE name = 'Events')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_ethics') AND
      committee_id IN (SELECT id FROM public.committees WHERE name = 'Ethics')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_quran') AND
      committee_id IN (SELECT id FROM public.committees WHERE name = 'Quran')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_ashbal') AND
      committee_id IN (SELECT id FROM public.committees WHERE name = 'Ashbal')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_marketing') AND
      committee_id IN (SELECT id FROM public.committees WHERE name = 'Marketing')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_media') AND
      committee_id IN (SELECT id FROM public.committees WHERE name IN ('Media', 'Marketing'))
    )
    OR
    -- 3. Generic Committee Leader
    (
      public.has_role(auth.uid(), 'committee_leader') AND
      committee_id = public.get_user_committee_id(auth.uid())
    )
  )
);
