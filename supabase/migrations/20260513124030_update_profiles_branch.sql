DO $$ 
DECLARE
  v_branch_id uuid;
BEGIN
  -- Get the branch ID for 'ma' (المهندسين)
  SELECT id INTO v_branch_id FROM branches WHERE code = 'ma' LIMIT 1;

  IF v_branch_id IS NOT NULL THEN
    -- Update all profiles that don't have a branch assigned
    UPDATE profiles
    SET branch_id = v_branch_id
    WHERE branch_id IS NULL;
    
    -- Also update users_followup that don't have a branch assigned just in case
    UPDATE users_followup
    SET branch_id = v_branch_id
    WHERE branch_id IS NULL;
  END IF;
END $$;
