-- Create group_submissions table
CREATE TABLE public.group_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID REFERENCES public.profiles(id) NOT NULL,
  activity_type_id UUID REFERENCES public.activity_types(id) NOT NULL,
  committee_id UUID REFERENCES public.committees(id) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  guest_participants JSONB DEFAULT '[]'::jsonb,
  excel_sheet_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add group_submission_id to activity_submissions
ALTER TABLE public.activity_submissions 
ADD COLUMN group_submission_id UUID REFERENCES public.group_submissions(id);

-- Enable RLS on group_submissions
ALTER TABLE public.group_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for group_submissions
CREATE POLICY "Committee leaders can view their own group submissions" ON public.group_submissions
  FOR SELECT USING (auth.uid() = leader_id);

CREATE POLICY "Committee leaders can create group submissions" ON public.group_submissions
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'committee_leader') AND
    committee_id = public.get_user_committee_id(auth.uid())
  );

CREATE POLICY "Supervisors and admins can view all group submissions" ON public.group_submissions
  FOR SELECT USING (
    public.has_role(auth.uid(), 'supervisor') OR 
    public.has_role(auth.uid(), 'admin')
  );

-- Update RLS for activity_submissions to allow committee leaders to insert for others
DROP POLICY IF EXISTS "Users can create own submissions" ON public.activity_submissions;

CREATE POLICY "Users can create own submissions" ON public.activity_submissions
  FOR INSERT WITH CHECK (auth.uid() = volunteer_id);

CREATE POLICY "Committee leaders can create submissions for their committee" ON public.activity_submissions
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'committee_leader') AND
    committee_id = public.get_user_committee_id(auth.uid())
  );
