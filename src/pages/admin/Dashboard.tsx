import { Users, Activity, Award, ClipboardCheck, Building2, TrendingUp } from 'lucide-react';
import { StatsCard } from '@/components/ui/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardStats, mockSubmissions, mockVolunteers, committees } from '@/data/mockData';
import { LevelBadge } from '@/components/ui/level-badge';

export default function AdminDashboard() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of RTC Pulse volunteer management system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Total Volunteers"
          value={dashboardStats.totalVolunteers}
          icon={Users}
          description="Active volunteers"
        />
        <StatsCard
          title="Total Activities"
          value={dashboardStats.totalActivities}
          icon={Activity}
          description="Approved submissions"
        />
        <StatsCard
          title="Points Awarded"
          value={dashboardStats.totalPointsAwarded.toLocaleString()}
          icon={Award}
          description="Total points earned"
        />
        <StatsCard
          title="Pending Reviews"
          value={dashboardStats.pendingSubmissions}
          icon={ClipboardCheck}
          description="Awaiting approval"
          className={dashboardStats.pendingSubmissions > 0 ? 'border-warning' : ''}
        />
        <StatsCard
          title="Active Committees"
          value={dashboardStats.activeCommittees}
          icon={Building2}
          description="Registered committees"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Submissions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Recent Submissions
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
                    <span className="text-sm font-medium">+{submission.points} pts</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        submission.status === 'approved'
                          ? 'bg-success/10 text-success'
                          : submission.status === 'rejected'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {submission.status}
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
              Top Volunteers
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
                    <p className="text-xs text-muted-foreground">{volunteer.totalPoints} points</p>
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
            Committee Performance
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
                  <span className="text-muted-foreground">Volunteers</span>
                  <span className="font-medium">{committee.volunteerCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Points</span>
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
