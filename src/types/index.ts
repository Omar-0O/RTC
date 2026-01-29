export type UserRole = 'volunteer' | 'supervisor' | 'admin' | 'committee_leader' | 'hr' | 'head_hr' | 'head_caravans' | 'head_events' | 'head_production' | 'head_fourth_year' | 'head_ethics' | 'head_quran' | 'marketing_member';

export type VolunteerLevel = 'Newbie' | 'Active' | 'Silver' | 'Golden';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export type ActivityMode = 'online' | 'offline';

export interface Committee {
  id: string;
  name: string;
  description_ar: string | null;
  color: string | null;
  committee_type: 'production' | 'fourth_year';
}

export interface ActivityType {
  id: string;
  name: string;
  committeeId: string;
  points: number;
  description: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  committeeId?: string;
  avatarUrl?: string;
  joinedAt: string;
}

export interface VolunteerProfile extends User {
  role: 'volunteer';
  committeeId: string;
  totalPoints: number;
  level: VolunteerLevel;
  rank: number;
  badges: Badge[];
  activitiesCompleted: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

export interface ActivitySubmission {
  id: string;
  volunteerId: string;
  volunteerName: string;
  activityTypeId: string;
  activityTypeName: string;
  committeeId: string;
  committeeName: string;
  mode: ActivityMode;
  description: string;
  proofUrl?: string;
  status: SubmissionStatus;
  points: number;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl?: string;
  committeeId: string;
  committeeName: string;
  totalPoints: number;
  level: VolunteerLevel;
  activitiesCompleted: number;
}

export interface DashboardStats {
  totalVolunteers: number;
  totalActivities: number;
  totalPointsAwarded: number;
  pendingSubmissions: number;
  activeCommittees: number;
}
