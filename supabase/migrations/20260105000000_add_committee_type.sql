-- Add committee_type column to committees table
ALTER TABLE committees
ADD COLUMN committee_type text CHECK (committee_type IN ('production', 'fourth_year')) DEFAULT 'production';

-- Update existing committees to have a default type (optional, already handled by DEFAULT but good to be explicit if needed)
-- UPDATE committees SET committee_type = 'production' WHERE committee_type IS NULL;
