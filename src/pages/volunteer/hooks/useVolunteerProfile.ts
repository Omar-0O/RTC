import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type NamedRelation = {
  name: string | null;
  name_ar: string | null;
};

export type VolunteerProfileView = {
  id: string;
  email: string;
  full_name: string | null;
  full_name_ar: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  phone: string | null;
  join_date: string | null;
  birth_date: string | null;
  total_points: number | null;
  level: string | null;
  role?: string | null;
  is_ashbal: boolean | null;
  attended_mini_camp: boolean | null;
  attended_camp: boolean | null;
  committee_id: string | null;
  branch_id: string | null;
  committee?: NamedRelation | null;
  branch?: NamedRelation | null;
};

export type UserBadge = {
  id: string;
  earned_at: string;
  badge: {
    id: string;
    name: string;
    name_ar: string;
    description: string | null;
    description_ar: string | null;
    icon: string;
    color: string;
  };
};

export type ActivitySubmission = {
  id: string;
  activity_name: string;
  committee_name: string;
  points: number;
  status: string;
  submitted_at: string;
  proof_url: string | null;
  is_paid?: boolean;
};

export type VolunteerFeedback = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export type Fine = {
  source_type: string;
  source_id: string;
  source_name: string;
  source_name_ar: string;
  created_at: string;
  amount: number;
  is_paid: boolean;
  reviewed_by_name: string | null;
  reviewed_by_name_ar: string | null;
};

export type ActivityTypeOption = {
  id: string;
  name: string;
  name_ar: string;
};

export type FineTypeOption = ActivityTypeOption & {
  amount: number;
};

type BadgeRow = UserBadge;

type ActivityRow = {
  id: string;
  points_awarded: number | null;
  status: string;
  submitted_at: string;
  proof_url: string | null;
  is_paid: boolean | null;
  activity: NamedRelation | null;
  committee: NamedRelation | null;
};

type FeedbackRow = VolunteerFeedback;

type FineRow = Fine;

type QueryResponse<T> = {
  data: T | null;
  error: { message?: string } | null;
};

const emptyProfileState = {
  profile: null as VolunteerProfileView | null,
  avatarUrl: null as string | null,
  badges: [] as UserBadge[],
  activities: [] as ActivitySubmission[],
  feedbacks: [] as VolunteerFeedback[],
  fines: [] as Fine[],
  activityTypes: [] as ActivityTypeOption[],
  fineTypes: [] as FineTypeOption[],
};

export function useVolunteerProfile(targetUserId: string | undefined, isRTL: boolean) {
  const [loading, setLoading] = useState(Boolean(targetUserId));
  const [profile, setProfile] = useState<VolunteerProfileView | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [activities, setActivities] = useState<ActivitySubmission[]>([]);
  const [feedbacks, setFeedbacks] = useState<VolunteerFeedback[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeOption[]>([]);
  const [fineTypes, setFineTypes] = useState<FineTypeOption[]>([]);

  const reset = useCallback(() => {
    setProfile(emptyProfileState.profile);
    setAvatarUrl(emptyProfileState.avatarUrl);
    setBadges(emptyProfileState.badges);
    setActivities(emptyProfileState.activities);
    setFeedbacks(emptyProfileState.feedbacks);
    setFines(emptyProfileState.fines);
    setActivityTypes(emptyProfileState.activityTypes);
    setFineTypes(emptyProfileState.fineTypes);
  }, []);

  const refetch = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      reset();
      return;
    }

    setLoading(true);
    try {
      const profileQuery = supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          full_name_ar,
          avatar_url,
          cover_url,
          phone,
          join_date,
          birth_date,
          total_points,
          level,
          is_ashbal,
          attended_mini_camp,
          attended_camp,
          committee_id,
          branch_id,
          branch:branches(name, name_ar),
          committee:committees(name, name_ar)
        `)
        .eq('id', targetUserId)
        .single();

      const badgesQuery = supabase
        .from('user_badges')
        .select('id, earned_at, badge:badges(id, name, name_ar, description, description_ar, icon, color)')
        .eq('user_id', targetUserId)
        .order('earned_at', { ascending: false });

      const activitiesQuery = supabase
        .from('activity_submissions')
        .select('id, points_awarded, status, submitted_at, proof_url, is_paid, fine_type_id, activity:activity_types(name, name_ar), committee:committees(name, name_ar)')
        .eq('volunteer_id', targetUserId)
        .is('fine_type_id', null)
        .order('submitted_at', { ascending: false });

      const feedbacksQuery = supabase
        .from('volunteer_feedbacks')
        .select('id, content, created_at, author_id, author:profiles!volunteer_feedbacks_author_id_fkey(full_name, avatar_url)')
        .eq('volunteer_id', targetUserId)
        .order('created_at', { ascending: false });

      const finesQuery = supabase
        .from('volunteer_fines_view')
        .select('source_type, source_id, source_name, source_name_ar, created_at, amount, is_paid, reviewed_by_name, reviewed_by_name_ar')
        .eq('volunteer_id', targetUserId)
        .eq('source_type', 'manual')
        .order('created_at', { ascending: false });

      const [
        profileRes,
        badgesRes,
        activitiesRes,
        feedbacksRes,
        finesRes,
        typesRes,
        fineTypesRes,
      ] = await Promise.all([
        profileQuery,
        badgesQuery,
        activitiesQuery,
        feedbacksQuery,
        finesQuery,
        supabase.from('activity_types').select('id, name, name_ar').order('name'),
        supabase.from('fine_types').select('id, name, name_ar, amount').order('name'),
      ]) as [
        QueryResponse<VolunteerProfileView>,
        QueryResponse<BadgeRow[]>,
        QueryResponse<ActivityRow[]>,
        QueryResponse<FeedbackRow[]>,
        QueryResponse<FineRow[]>,
        QueryResponse<ActivityTypeOption[]>,
        QueryResponse<FineTypeOption[]>,
      ];

      if (profileRes.error) throw profileRes.error;
      if (badgesRes.error) throw badgesRes.error;
      if (activitiesRes.error) throw activitiesRes.error;
      if (feedbacksRes.error) throw feedbacksRes.error;
      if (finesRes.error) throw finesRes.error;
      if (typesRes.error) throw typesRes.error;
      if (fineTypesRes.error) throw fineTypesRes.error;

      setProfile(profileRes.data);
      setAvatarUrl(profileRes.data?.avatar_url ?? null);
      setBadges(badgesRes.data ?? []);
      setActivityTypes(typesRes.data ?? []);
      setFineTypes(fineTypesRes.data ?? []);
      setFeedbacks(feedbacksRes.data ?? []);
      setFines((finesRes.data ?? []).map((fine) => ({
        ...fine,
        is_paid: fine.is_paid || false,
      })));
      setActivities((activitiesRes.data ?? []).map((activity) => ({
        id: activity.id,
        activity_name: isRTL
          ? (activity.activity?.name_ar || activity.activity?.name || '')
          : (activity.activity?.name || ''),
        committee_name: isRTL
          ? (activity.committee?.name_ar || activity.committee?.name || '')
          : (activity.committee?.name || ''),
        points: activity.points_awarded || 0,
        status: activity.status,
        submitted_at: activity.submitted_at,
        proof_url: activity.proof_url,
        is_paid: activity.is_paid ?? undefined,
      })));
    } finally {
      setLoading(false);
    }
  }, [isRTL, reset, targetUserId]);

  useEffect(() => {
    reset();
    void refetch();
  }, [refetch, reset]);

  return {
    loading,
    profile,
    avatarUrl,
    badges,
    activities,
    feedbacks,
    fines,
    activityTypes,
    fineTypes,
    refetch,
    setAvatarUrl,
    setFeedbacks,
  };
}
