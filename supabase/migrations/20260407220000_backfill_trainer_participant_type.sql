-- Backfill participant_type and trainer_id for existing trainer submissions
-- These rows were created by createTrainerParticipation without the two fields.
-- We identify them by joining with the 'trainers' table via user_id = volunteer_id
-- and the activity_type being 'Trainer Lecture'.

UPDATE activity_submissions AS sub
SET
    participant_type = 'trainer',
    trainer_id       = t.id
FROM trainers AS t
JOIN activity_types AS at ON at.name = 'Trainer Lecture'
WHERE sub.volunteer_id = t.user_id
  AND sub.activity_type_id = at.id
  AND (sub.participant_type IS DISTINCT FROM 'trainer' OR sub.trainer_id IS NULL);
