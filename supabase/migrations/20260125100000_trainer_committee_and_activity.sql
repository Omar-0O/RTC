-- Migration: Create trainer committee and activity type for auto-recording trainer participations
-- This enables automatic participation tracking when organizers mark lectures as completed

-- Create trainer committee
INSERT INTO committees (id, name, name_ar, description_ar, description)
VALUES (
  gen_random_uuid(),
  'Trainer',
  'مدرب',
  'لجنة خاصة بمحاضرات المدربين',
  'Special committee for trainer lectures'
) ON CONFLICT DO NOTHING;

-- Create trainer lecture activity type linked to the trainer committee
INSERT INTO activity_types (id, name, name_ar, description, description_ar, points, points_with_vest, points_without_vest, mode, committee_id)
SELECT 
  gen_random_uuid(),
  'Trainer Lecture',
  'محاضرة مدرب',
  'Lecture delivered by a trainer',
  'محاضرة قدمها المدرب',
  10,  -- Base points for a lecture
  10,  -- With vest (same as base)
  10,  -- Without vest (same as base)
  'individual',
  c.id
FROM committees c WHERE c.name = 'Trainer'
ON CONFLICT DO NOTHING;
