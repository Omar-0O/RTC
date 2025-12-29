import { Users, Activity, Award, ClipboardCheck, Building2, TrendingUp } from 'lucide-react';
import { StatsCard } from '@/components/ui/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardStats, mockSubmissions, mockVolunteers, committees } from '@/data/mockData';
import { LevelBadge } from '@/components/ui/level-badge';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AdminDashboard() {
  const { t, isRTL } = useLanguage();

  const recentSubmissions = mockSubmissions
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5);

  const topVolunteers = mockVolunteers.slice(0, 5);

  const committeeStats = committees.map(committee => {
    const volunteers = mockVolunteers.filter(v => v.committeeId === committee.id);
    const totalPoints = volunteers.reduce((sum, v) => sum + v.totalPoints, 0);
    return {
      ...committee,
      volunteerCount: volunteers.length,
      totalPoints,
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return t('common.approved');
      case 'rejected': return t('common.rejected');
      default: return t('common.pending');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('admin.dashboard')}</h1>
        <p className="text-muted-foreground">{t('admin.overview')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title={t('admin.totalVolunteers')}
          value={dashboardStats.totalVolunteers}
          icon={Users}
          description={t('common.volunteers')}
        />
        <StatsCard
          title={t('admin.totalActivities')}
          value={dashboardStats.totalActivities}
          icon={Activity}
          description={t('common.approved')}
        />
        <StatsCard
          title={t('admin.pointsAwarded')}
          value={dashboardStats.totalPointsAwarded.toLocaleString()}
          icon={Award}
          description={t('common.points')}
        />
        <StatsCard
          title={t('admin.pendingReviews')}
          value={dashboardStats.pendingSubmissions}
          icon={ClipboardCheck}
          description={t('common.pending')}
          className={dashboardStats.pendingSubmissions > 0 ? 'border-warning' : ''}
        />
        <StatsCard
          title={t('admin.activeCommittees')}
          value={dashboardStats.activeCommittees}
          icon={Building2}
          description={t('nav.committees')}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Submissions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {t('admin.recentSubmissions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{submission.volunteerName}</p>
                    <p className="text-sm text-muted-foreground">
                      {submission.activityTypeName} • {submission.committeeName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">+{submission.points} {t('common.points')}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        submission.status === 'approved'
                          ? 'bg-success/10 text-success'
                          : submission.status === 'rejected'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {getStatusText(submission.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Volunteers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('admin.topVolunteers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topVolunteers.map((volunteer, index) => (
                <div
                  key={volunteer.id}
                  className="flex items-center gap-3"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{volunteer.name}</p>
                    <p className="text-xs text-muted-foreground">{volunteer.totalPoints} {t('common.points')}</p>
                  </div>
                  <LevelBadge level={volunteer.level} size="sm" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Committee Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('admin.committeePerformance')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {committeeStats.map((committee) => (
              <div
                key={committee.id}
                className="rounded-lg border p-4 space-y-2"
              >
                <h4 className="font-medium text-sm">{committee.name}</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('common.volunteers')}</span>
                  <span className="font-medium">{committee.volunteerCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('committees.totalPoints')}</span>
                  <span className="font-medium">{committee.totalPoints}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
