import { 
  Committee, 
  ActivityType, 
  User, 
  VolunteerProfile, 
  ActivitySubmission, 
  LeaderboardEntry,
  DashboardStats,
  Badge
} from '@/types';

export const committees: Committee[] = [
  { id: 'it', name: 'IT Committee', description: 'Technology and digital solutions' },
  { id: 'dev', name: 'Development Committee', description: 'Training and skill development' },
  { id: 'lang', name: 'Languages Committee', description: 'Language courses and cultural exchange' },
  { id: 'quran', name: 'Quran Committee', description: 'Quran memorization and tajweed' },
  { id: 'hr', name: 'HR Committee', description: 'Human resources and volunteer management' },
  { id: 'marketing', name: 'Marketing Committee', description: 'Promotion and outreach' },
  { id: 'media', name: 'Media Committee', description: 'Content creation and social media' },
  { id: 'events', name: 'Events Committee', description: 'Event planning and coordination' },
  { id: 'finance', name: 'Finance Committee', description: 'Financial management and fundraising' },
  { id: 'logistics', name: 'Logistics Committee', description: 'Resource and supply management' },
  { id: 'education', name: 'Education Committee', description: 'Educational programs and tutoring' },
  { id: 'social', name: 'Social Committee', description: 'Community engagement activities' },
];

export const activityTypes: ActivityType[] = [
  // IT Committee
  { id: 'it-1', name: 'Website Development', committeeId: 'it', points: 50, description: 'Build or update website features' },
  { id: 'it-2', name: 'Technical Support', committeeId: 'it', points: 20, description: 'Provide IT support to team members' },
  { id: 'it-3', name: 'System Maintenance', committeeId: 'it', points: 30, description: 'Maintain and update systems' },
  
  // Development Committee
  { id: 'dev-1', name: 'Training Session', committeeId: 'dev', points: 40, description: 'Conduct a training session' },
  { id: 'dev-2', name: 'Workshop Facilitation', committeeId: 'dev', points: 35, description: 'Facilitate a workshop' },
  { id: 'dev-3', name: 'Curriculum Development', committeeId: 'dev', points: 45, description: 'Develop training materials' },
  
  // Languages Committee
  { id: 'lang-1', name: 'Language Class', committeeId: 'lang', points: 30, description: 'Teach a language class' },
  { id: 'lang-2', name: 'Conversation Practice', committeeId: 'lang', points: 20, description: 'Lead conversation sessions' },
  { id: 'lang-3', name: 'Translation Work', committeeId: 'lang', points: 25, description: 'Translate documents' },
  
  // Quran Committee
  { id: 'quran-1', name: 'Quran Circle', committeeId: 'quran', points: 35, description: 'Lead Quran recitation circle' },
  { id: 'quran-2', name: 'Tajweed Session', committeeId: 'quran', points: 30, description: 'Teach tajweed rules' },
  { id: 'quran-3', name: 'Memorization Help', committeeId: 'quran', points: 25, description: 'Help with Quran memorization' },
  
  // HR Committee
  { id: 'hr-1', name: 'Interview Volunteers', committeeId: 'hr', points: 25, description: 'Interview new volunteers' },
  { id: 'hr-2', name: 'Onboarding Session', committeeId: 'hr', points: 30, description: 'Onboard new volunteers' },
  { id: 'hr-3', name: 'Team Building', committeeId: 'hr', points: 35, description: 'Organize team activities' },
  
  // Marketing Committee
  { id: 'mkt-1', name: 'Campaign Design', committeeId: 'marketing', points: 40, description: 'Design marketing campaign' },
  { id: 'mkt-2', name: 'Content Writing', committeeId: 'marketing', points: 25, description: 'Write promotional content' },
  { id: 'mkt-3', name: 'Outreach Activity', committeeId: 'marketing', points: 30, description: 'Community outreach' },
  
  // Media Committee
  { id: 'media-1', name: 'Video Production', committeeId: 'media', points: 45, description: 'Produce video content' },
  { id: 'media-2', name: 'Photography', committeeId: 'media', points: 25, description: 'Event photography' },
  { id: 'media-3', name: 'Social Media Post', committeeId: 'media', points: 15, description: 'Create social media content' },
  
  // Events Committee
  { id: 'evt-1', name: 'Event Planning', committeeId: 'events', points: 40, description: 'Plan and organize events' },
  { id: 'evt-2', name: 'Event Coordination', committeeId: 'events', points: 35, description: 'Coordinate event logistics' },
  { id: 'evt-3', name: 'Event Support', committeeId: 'events', points: 20, description: 'Support during events' },
  
  // General activities
  { id: 'gen-1', name: 'Meeting Attendance', committeeId: 'all', points: 10, description: 'Attend committee meeting' },
  { id: 'gen-2', name: 'Special Task', committeeId: 'all', points: 15, description: 'Complete assigned special task' },
];

export const badges: Badge[] = [
  { id: 'first-activity', name: 'First Steps', description: 'Complete your first activity', icon: '🎯', earnedAt: '' },
  { id: 'five-activities', name: 'Getting Started', description: 'Complete 5 activities', icon: '⭐', earnedAt: '' },
  { id: 'ten-activities', name: 'Dedicated', description: 'Complete 10 activities', icon: '🏆', earnedAt: '' },
  { id: 'fifty-points', name: 'Rising Star', description: 'Earn 50 points', icon: '🌟', earnedAt: '' },
  { id: 'hundred-points', name: 'Achiever', description: 'Earn 100 points', icon: '💫', earnedAt: '' },
  { id: 'top-ten', name: 'Top Performer', description: 'Reach top 10 on leaderboard', icon: '🥇', earnedAt: '' },
];

export const mockUsers: User[] = [
  { id: 'admin-1', email: 'admin@rtc.org', name: 'Ahmed Hassan', role: 'admin', joinedAt: '2023-01-15' },
  { id: 'sup-1', email: 'supervisor.it@rtc.org', name: 'Fatima Ali', role: 'supervisor', committeeId: 'it', joinedAt: '2023-02-20' },
  { id: 'sup-2', email: 'supervisor.dev@rtc.org', name: 'Omar Khaled', role: 'supervisor', committeeId: 'dev', joinedAt: '2023-03-10' },
  { id: 'sup-3', email: 'supervisor.lang@rtc.org', name: 'Layla Ahmed', role: 'supervisor', committeeId: 'lang', joinedAt: '2023-03-15' },
  // Committee Leaders
  { id: 'leader-1', email: 'leader.it@rtc.org', name: 'Mohamed Fathy', role: 'committee_leader', committeeId: 'it', joinedAt: '2023-02-25' },
  { id: 'leader-2', email: 'leader.dev@rtc.org', name: 'Amira Saleh', role: 'committee_leader', committeeId: 'dev', joinedAt: '2023-03-05' },
  { id: 'leader-3', email: 'leader.lang@rtc.org', name: 'Hassan Ibrahim', role: 'committee_leader', committeeId: 'lang', joinedAt: '2023-03-20' },
];

export const mockVolunteers: VolunteerProfile[] = [
  {
    id: 'vol-1', email: 'volunteer1@rtc.org', name: 'Sara Mohamed', role: 'volunteer',
    committeeId: 'it', totalPoints: 280, level: 'Silver', rank: 1, activitiesCompleted: 12,
    badges: [badges[0], badges[1], badges[2], badges[3], badges[4]], joinedAt: '2023-06-01'
  },
  {
    id: 'vol-2', email: 'volunteer2@rtc.org', name: 'Youssef Ibrahim', role: 'volunteer',
    committeeId: 'dev', totalPoints: 245, level: 'Silver', rank: 2, activitiesCompleted: 10,
    badges: [badges[0], badges[1], badges[2], badges[3]], joinedAt: '2023-06-15'
  },
  {
    id: 'vol-3', email: 'volunteer3@rtc.org', name: 'Nour El-Din', role: 'volunteer',
    committeeId: 'lang', totalPoints: 190, level: 'Active', rank: 3, activitiesCompleted: 8,
    badges: [badges[0], badges[1], badges[3]], joinedAt: '2023-07-01'
  },
  {
    id: 'vol-4', email: 'volunteer4@rtc.org', name: 'Mariam Sayed', role: 'volunteer',
    committeeId: 'marketing', totalPoints: 175, level: 'Active', rank: 4, activitiesCompleted: 7,
    badges: [badges[0], badges[1], badges[3]], joinedAt: '2023-07-10'
  },
  {
    id: 'vol-5', email: 'volunteer5@rtc.org', name: 'Kareem Nasser', role: 'volunteer',
    committeeId: 'events', totalPoints: 160, level: 'Active', rank: 5, activitiesCompleted: 6,
    badges: [badges[0], badges[1]], joinedAt: '2023-07-20'
  },
  {
    id: 'vol-6', email: 'volunteer6@rtc.org', name: 'Hana Mahmoud', role: 'volunteer',
    committeeId: 'media', totalPoints: 145, level: 'Active', rank: 6, activitiesCompleted: 6,
    badges: [badges[0], badges[1]], joinedAt: '2023-08-01'
  },
  {
    id: 'vol-7', email: 'volunteer7@rtc.org', name: 'Ali Mostafa', role: 'volunteer',
    committeeId: 'quran', totalPoints: 130, level: 'Active', rank: 7, activitiesCompleted: 5,
    badges: [badges[0], badges[1]], joinedAt: '2023-08-10'
  },
  {
    id: 'vol-8', email: 'volunteer8@rtc.org', name: 'Dina Adel', role: 'volunteer',
    committeeId: 'hr', totalPoints: 115, level: 'Active', rank: 8, activitiesCompleted: 5,
    badges: [badges[0]], joinedAt: '2023-08-15'
  },
  {
    id: 'vol-9', email: 'volunteer9@rtc.org', name: 'Tarek Farouk', role: 'volunteer',
    committeeId: 'finance', totalPoints: 85, level: 'Active', rank: 9, activitiesCompleted: 4,
    badges: [badges[0]], joinedAt: '2023-09-01'
  },
  {
    id: 'vol-10', email: 'volunteer10@rtc.org', name: 'Salma Amr', role: 'volunteer',
    committeeId: 'logistics', totalPoints: 70, level: 'Newbie', rank: 10, activitiesCompleted: 3,
    badges: [badges[0]], joinedAt: '2023-09-10'
  },
  {
    id: 'vol-11', email: 'volunteer11@rtc.org', name: 'Mohamed Sherif', role: 'volunteer',
    committeeId: 'education', totalPoints: 55, level: 'Newbie', rank: 11, activitiesCompleted: 2,
    badges: [], joinedAt: '2023-09-20'
  },
  {
    id: 'vol-12', email: 'volunteer12@rtc.org', name: 'Aya Gamal', role: 'volunteer',
    committeeId: 'social', totalPoints: 40, level: 'Newbie', rank: 12, activitiesCompleted: 2,
    badges: [], joinedAt: '2023-10-01'
  },
];

export const mockSubmissions: ActivitySubmission[] = [
  {
    id: 'sub-1', volunteerId: 'vol-1', volunteerName: 'Sara Mohamed',
    activityTypeId: 'it-1', activityTypeName: 'Website Development',
    committeeId: 'it', committeeName: 'IT Committee',
    mode: 'online', description: 'Updated the volunteer portal with new features',
    status: 'pending', points: 50, submittedAt: '2024-01-10T10:30:00Z'
  },
  {
    id: 'sub-2', volunteerId: 'vol-2', volunteerName: 'Youssef Ibrahim',
    activityTypeId: 'dev-1', activityTypeName: 'Training Session',
    committeeId: 'dev', committeeName: 'Development Committee',
    mode: 'offline', description: 'Conducted leadership training for new volunteers',
    status: 'pending', points: 40, submittedAt: '2024-01-09T14:00:00Z'
  },
  {
    id: 'sub-3', volunteerId: 'vol-3', volunteerName: 'Nour El-Din',
    activityTypeId: 'lang-1', activityTypeName: 'Language Class',
    committeeId: 'lang', committeeName: 'Languages Committee',
    mode: 'offline', description: 'Taught English conversation class',
    status: 'approved', points: 30, submittedAt: '2024-01-08T09:00:00Z',
    reviewedAt: '2024-01-08T16:00:00Z', reviewedBy: 'Layla Ahmed'
  },
  {
    id: 'sub-4', volunteerId: 'vol-4', volunteerName: 'Mariam Sayed',
    activityTypeId: 'mkt-1', activityTypeName: 'Campaign Design',
    committeeId: 'marketing', committeeName: 'Marketing Committee',
    mode: 'online', description: 'Created social media campaign for Ramadan',
    status: 'approved', points: 40, submittedAt: '2024-01-07T11:00:00Z',
    reviewedAt: '2024-01-07T17:00:00Z', reviewedBy: 'Admin'
  },
  {
    id: 'sub-5', volunteerId: 'vol-1', volunteerName: 'Sara Mohamed',
    activityTypeId: 'it-2', activityTypeName: 'Technical Support',
    committeeId: 'it', committeeName: 'IT Committee',
    mode: 'online', description: 'Helped fix email issues for team members',
    status: 'rejected', points: 20, submittedAt: '2024-01-06T15:00:00Z',
    reviewedAt: '2024-01-07T10:00:00Z', reviewedBy: 'Fatima Ali',
    reviewNote: 'Please provide more details about the support provided'
  },
  {
    id: 'sub-6', volunteerId: 'vol-5', volunteerName: 'Kareem Nasser',
    activityTypeId: 'evt-1', activityTypeName: 'Event Planning',
    committeeId: 'events', committeeName: 'Events Committee',
    mode: 'offline', description: 'Planned the annual volunteer appreciation event',
    status: 'pending', points: 40, submittedAt: '2024-01-10T08:00:00Z'
  },
];

export const leaderboardData: LeaderboardEntry[] = mockVolunteers.map((v, index) => ({
  rank: index + 1,
  userId: v.id,
  userName: v.name,
  committeeId: v.committeeId,
  committeeName: committees.find(c => c.id === v.committeeId)?.name || '',
  totalPoints: v.totalPoints,
  level: v.level,
  activitiesCompleted: v.activitiesCompleted,
}));

export const dashboardStats: DashboardStats = {
  totalVolunteers: mockVolunteers.length,
  totalActivities: mockSubmissions.filter(s => s.status === 'approved').length,
  totalPointsAwarded: mockVolunteers.reduce((sum, v) => sum + v.totalPoints, 0),
  pendingSubmissions: mockSubmissions.filter(s => s.status === 'pending').length,
  activeCommittees: committees.length,
};

// Current logged-in user simulation
export const getCurrentUser = (role: 'volunteer' | 'supervisor' | 'admin' = 'volunteer') => {
  switch (role) {
    case 'admin':
      return mockUsers[0];
    case 'supervisor':
      return mockUsers[1];
    case 'volunteer':
    default:
      return mockVolunteers[0];
  }
};

export const getVolunteerProfile = (userId: string): VolunteerProfile | undefined => {
  return mockVolunteers.find(v => v.id === userId);
};

export const getCommitteeActivities = (committeeId: string): ActivityType[] => {
  return activityTypes.filter(a => a.committeeId === committeeId || a.committeeId === 'all');
};

export const getPendingSubmissions = (committeeId?: string): ActivitySubmission[] => {
  const pending = mockSubmissions.filter(s => s.status === 'pending');
  if (committeeId) {
    return pending.filter(s => s.committeeId === committeeId);
  }
  return pending;
};

export const getLeaderboard = (committeeId?: string): LeaderboardEntry[] => {
  if (committeeId) {
    return leaderboardData
      .filter(e => e.committeeId === committeeId)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }
  return leaderboardData;
};
