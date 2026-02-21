-- Create quran_circle_marketers table
CREATE TABLE IF NOT EXISTS quran_circle_marketers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES quran_circles(id) ON DELETE CASCADE,
  volunteer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(circle_id, volunteer_id)
);

-- Enable RLS
ALTER TABLE quran_circle_marketers ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated users can read
DROP POLICY IF EXISTS "Authenticated users can view circle marketers" ON quran_circle_marketers;
CREATE POLICY "Authenticated users can view circle marketers"
  ON quran_circle_marketers FOR SELECT
  TO authenticated
  USING (true);

-- RLS: admin, head_quran, head_marketing can manage
DROP POLICY IF EXISTS "Admins and heads can manage circle marketers" ON quran_circle_marketers;
CREATE POLICY "Admins and heads can manage circle marketers"
  ON quran_circle_marketers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'head_quran', 'head_marketing')
    )
  );

-- Create quran_circle_ads table
CREATE TABLE IF NOT EXISTS quran_circle_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES quran_circles(id) ON DELETE CASCADE,
  ad_number int NOT NULL,
  ad_date date NOT NULL,
  poster_done boolean NOT NULL DEFAULT false,
  content_done boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE quran_circle_ads ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated users can read
DROP POLICY IF EXISTS "Authenticated users can view circle ads" ON quran_circle_ads;
CREATE POLICY "Authenticated users can view circle ads"
  ON quran_circle_ads FOR SELECT
  TO authenticated
  USING (true);

-- RLS: admin, head_quran, head_marketing can manage (full CRUD)
DROP POLICY IF EXISTS "Admins and heads can manage circle ads" ON quran_circle_ads;
CREATE POLICY "Admins and heads can manage circle ads"
  ON quran_circle_ads FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'head_quran', 'head_marketing')
    )
  );

-- RLS: assigned marketers can update poster_done / content_done
DROP POLICY IF EXISTS "Marketers can update ad status" ON quran_circle_ads;
CREATE POLICY "Marketers can update ad status"
  ON quran_circle_ads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quran_circle_marketers
      WHERE circle_id = quran_circle_ads.circle_id
        AND volunteer_id = auth.uid()
    )
  )
  WITH CHECK (true);
