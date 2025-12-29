
-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'committee_leader', 'volunteer');
CREATE TYPE public.volunteer_level AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'diamond');
CREATE TYPE public.submission_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.activity_mode AS ENUM ('individual', 'group');

-- Create committees table
CREATE TABLE public.committees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'volunteer',
  UNIQUE (user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  full_name_ar TEXT,
  avatar_url TEXT,
  phone TEXT,
  committee_id UUID REFERENCES public.committees(id),
  total_points INTEGER NOT NULL DEFAULT 0,
  level public.volunteer_level NOT NULL DEFAULT 'bronze',
  activities_count INTEGER NOT NULL DEFAULT 0,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create activity_types table
CREATE TABLE public.activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  points INTEGER NOT NULL DEFAULT 10,
  mode public.activity_mode NOT NULL DEFAULT 'individual',
  committee_id UUID REFERENCES public.committees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create activity_submissions table
CREATE TABLE public.activity_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  activity_type_id UUID REFERENCES public.activity_types(id) NOT NULL,
  committee_id UUID REFERENCES public.committees(id) NOT NULL,
  description TEXT,
  proof_url TEXT,
  hours_spent DECIMAL(4,2),
  participants_count INTEGER DEFAULT 1,
  status public.submission_status NOT NULL DEFAULT 'pending',
  points_awarded INTEGER DEFAULT 0,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create badges table
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  icon TEXT NOT NULL DEFAULT 'award',
  color TEXT NOT NULL DEFAULT '#F59E0B',
  points_required INTEGER,
  activities_required INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_badges table
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

-- Enable RLS on all tables
ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user's committee_id
CREATE OR REPLACE FUNCTION public.get_user_committee_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT committee_id FROM public.profiles WHERE id = _user_id
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Calculate level based on points
CREATE OR REPLACE FUNCTION public.calculate_level(points INTEGER)
RETURNS public.volunteer_level AS $$
BEGIN
  IF points >= 5000 THEN RETURN 'diamond';
  ELSIF points >= 2500 THEN RETURN 'platinum';
  ELSIF points >= 1000 THEN RETURN 'gold';
  ELSIF points >= 500 THEN RETURN 'silver';
  ELSE RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Trigger to update user points when submission is approved
CREATE OR REPLACE FUNCTION public.update_user_points_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.profiles
    SET 
      total_points = total_points + NEW.points_awarded,
      activities_count = activities_count + 1,
      level = public.calculate_level(total_points + NEW.points_awarded)
    WHERE id = NEW.volunteer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'volunteer');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
CREATE TRIGGER update_committees_updated_at
  BEFORE UPDATE ON public.committees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activity_types_updated_at
  BEFORE UPDATE ON public.activity_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_submission_approved
  AFTER UPDATE ON public.activity_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_user_points_on_approval();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for committees
CREATE POLICY "Committees are viewable by everyone" ON public.committees
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage committees" ON public.committees
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for activity_types
CREATE POLICY "Activity types are viewable by everyone" ON public.activity_types
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage activity types" ON public.activity_types
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for activity_submissions
CREATE POLICY "Users can view own submissions" ON public.activity_submissions
  FOR SELECT USING (auth.uid() = volunteer_id);

CREATE POLICY "Users can create own submissions" ON public.activity_submissions
  FOR INSERT WITH CHECK (auth.uid() = volunteer_id);

CREATE POLICY "Committee leaders can view their committee submissions" ON public.activity_submissions
  FOR SELECT USING (
    public.has_role(auth.uid(), 'committee_leader') AND 
    committee_id = public.get_user_committee_id(auth.uid())
  );

CREATE POLICY "Supervisors and admins can view all submissions" ON public.activity_submissions
  FOR SELECT USING (
    public.has_role(auth.uid(), 'supervisor') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Supervisors and admins can update submissions" ON public.activity_submissions
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'supervisor') OR 
    public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for badges
CREATE POLICY "Badges are viewable by everyone" ON public.badges
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage badges" ON public.badges
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_badges
CREATE POLICY "User badges are viewable by everyone" ON public.user_badges
  FOR SELECT USING (true);

CREATE POLICY "System can award badges" ON public.user_badges
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
