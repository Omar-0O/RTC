-- Start of migration: Fix Quran head group participations

-- 1. Ensure a group activity exists for the Quran committee
DO $$
DECLARE
    v_quran_committee_id UUID;
    v_activity_type_id UUID;
BEGIN
    SELECT id INTO v_quran_committee_id FROM public.committees WHERE name ILIKE '%Quran%' OR name_ar ILIKE '%قرآن%' LIMIT 1;

    IF v_quran_committee_id IS NOT NULL THEN
        -- Check if there's already a group activity for Quran
        IF NOT EXISTS (
            SELECT 1 FROM public.activity_types 
            WHERE mode = 'group' AND id IN (
                SELECT activity_type_id FROM public.activity_type_committees WHERE committee_id = v_quran_committee_id
            )
        ) THEN
            -- Create a new group activity for Quran
            INSERT INTO public.activity_types (name, name_ar, description, description_ar, points, mode)
            VALUES (
                'Quran Group Participation', 
                'مشاركة جماعية - قرآن', 
                'Group participation for the Quran committee', 
                'مشاركة جماعية لمجموعة من المتطوعين في أنشطة القرآن', 
                10, 
                'group'
            )
            RETURNING id INTO v_activity_type_id;

            -- Link it using the modern relation
            INSERT INTO public.activity_type_committees (activity_type_id, committee_id)
            VALUES (v_activity_type_id, v_quran_committee_id);
        END IF;
    END IF;
END $$;

-- 2. Adjust RLS policies to be robust against committee name variations
DROP POLICY IF EXISTS "Privileged users can create group submissions" ON public.group_submissions;

CREATE POLICY "Privileged users can create group submissions"
ON public.group_submissions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor', 'head_hr', 'hr')
  )
  OR
  (
    (
      public.has_role(auth.uid(), 'head_caravans') AND
      committee_id IN (SELECT id FROM public.committees WHERE name ILIKE '%Caravan%')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_events') AND
      committee_id IN (SELECT id FROM public.committees WHERE name ILIKE '%Event%')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_ethics') AND
      committee_id IN (SELECT id FROM public.committees WHERE name ILIKE '%Ethic%')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_quran') AND
      committee_id IN (SELECT id FROM public.committees WHERE name ILIKE '%Quran%' OR name_ar ILIKE '%قرآن%')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_ashbal') AND
      committee_id IN (SELECT id FROM public.committees WHERE name ILIKE '%Ashbal%')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_marketing') AND
      committee_id IN (SELECT id FROM public.committees WHERE name ILIKE '%Marketing%')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_media') AND
      committee_id IN (SELECT id FROM public.committees WHERE name IN ('Media', 'Marketing'))
    )
    OR
    (
      public.has_role(auth.uid(), 'committee_leader') AND
      committee_id = public.get_user_committee_id(auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Committee leaders can create submissions for their committee" ON public.activity_submissions;

CREATE POLICY "Committee leaders can create submissions for their committee"
ON public.activity_submissions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor', 'head_hr', 'hr')
  )
  OR
  (
    (
      public.has_role(auth.uid(), 'head_caravans') AND
      committee_id IN (SELECT id FROM public.committees WHERE name ILIKE '%Caravan%')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_events') AND
      committee_id IN (SELECT id FROM public.committees WHERE name ILIKE '%Event%')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_ethics') AND
      committee_id IN (SELECT id FROM public.committees WHERE name ILIKE '%Ethic%')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_quran') AND
      committee_id IN (SELECT id FROM public.committees WHERE name ILIKE '%Quran%' OR name_ar ILIKE '%قرآن%')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_ashbal') AND
      committee_id IN (SELECT id FROM public.committees WHERE name ILIKE '%Ashbal%')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_marketing') AND
      committee_id IN (SELECT id FROM public.committees WHERE name ILIKE '%Marketing%')
    )
    OR
    (
      public.has_role(auth.uid(), 'head_media') AND
      committee_id IN (SELECT id FROM public.committees WHERE name IN ('Media', 'Marketing'))
    )
    OR
    (
      public.has_role(auth.uid(), 'committee_leader') AND
      committee_id = public.get_user_committee_id(auth.uid())
    )
  )
);
