SELECT conflicting_course_name FROM public.check_room_conflict('lab_1', ARRAY['monday'], '10:00'::TIME, '12:00'::TIME, '2026-05-01'::DATE, '2026-05-30'::DATE, NULL);
