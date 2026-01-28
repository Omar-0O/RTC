-- Ensure Marketing committee exists
INSERT INTO public.committees (name, name_ar, description, description_ar)
VALUES ('Marketing', 'التسويق', 'Marketing Committee', 'لجنة التسويق')
ON CONFLICT (name) DO NOTHING;

-- Add Marketing Activity Types
DO $$
DECLARE
    v_marketing_id UUID;
BEGIN
    SELECT id INTO v_marketing_id FROM public.committees WHERE name = 'Marketing';

    INSERT INTO public.activity_types (name, name_ar, points, description, description_ar, committee_id, mode)
    SELECT 'Course Ad Poster', 'تصميم بوستر كورس', 15, 'Designing a poster for a course ad', 'تصميم بوستر لإعلان كورس', v_marketing_id, 'individual'
    WHERE NOT EXISTS (SELECT 1 FROM public.activity_types WHERE name = 'Course Ad Poster');

    INSERT INTO public.activity_types (name, name_ar, points, description, description_ar, committee_id, mode)
    SELECT 'Course Ad Content', 'كتابة محتوى إعلان', 10, 'Writing content for a course ad', 'كتابة محتوى لإعلان كورس', v_marketing_id, 'individual'
    WHERE NOT EXISTS (SELECT 1 FROM public.activity_types WHERE name = 'Course Ad Content');
END $$;
