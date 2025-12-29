import { useState } from 'react';
import { Download, Calendar, TrendingUp, Users, Activity, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { mockVolunteers, committees, mockSubmissions, activityTypes } from '@/data/mockData';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

export default function Reports() {
  const { t } = useLanguage();
  const [dateRange, setDateRange] = useState('month');

  // Committee distribution data
  const committeeData = committees.map(committee => {
    const volunteers = mockVolunteers.filter(v => v.committeeId === committee.id);
    return {
      name: committee.name.replace(' Committee', ''),
      volunteers: volunteers.length,
      points: volunteers.reduce((sum, v) => sum + v.totalPoints, 0),
    };
  }).filter(c => c.volunteers > 0);

  // Level distribution data
  const levelData = [
    { name: t('level.newbie'), value: mockVolunteers.filter(v => v.level === 'Newbie').length, color: 'hsl(var(--level-newbie))' },
    { name: t('level.active'), value: mockVolunteers.filter(v => v.level === 'Active').length, color: 'hsl(var(--level-active))' },
    { name: t('level.silver'), value: mockVolunteers.filter(v => v.level === 'Silver').length, color: 'hsl(var(--level-silver))' },
    { name: t('level.golden'), value: mockVolunteers.filter(v => v.level === 'Golden').length, color: 'hsl(var(--level-golden))' },
  ];

  // Activity submissions over time (mock data)
  const activityTrend = [
    { month: 'Aug', submissions: 15, approved: 12 },
    { month: 'Sep', submissions: 22, approved: 18 },
    { month: 'Oct', submissions: 28, approved: 24 },
    { month: 'Nov', submissions: 35, approved: 30 },
    { month: 'Dec', submissions: 42, approved: 38 },
    { month: 'Jan', submissions: 48, approved: 42 },
  ];

  // Top activities by submissions
  const activityStats = activityTypes.map(activity => {
    const submissions = mockSubmissions.filter(s => s.activityTypeId === activity.id);
    return {
      name: activity.name,
      count: submissions.length,
      points: activity.points,
    };
  }).filter(a => a.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);

  const handleExport = (type: string) => {
    toast.success(`${t('reports.exportReport')}...`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('reports.title')}</h1>
          <p className="text-muted-foreground">{t('reports.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">{t('reports.thisWeek')}</SelectItem>
              <SelectItem value="month">{t('reports.thisMonth')}</SelectItem>
              <SelectItem value="quarter">{t('reports.thisQuarter')}</SelectItem>
              <SelectItem value="year">{t('reports.thisYear')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handleExport('full')}>
            <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t('reports.exportReport')}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('admin.totalVolunteers')}</p>
                <p className="text-2xl font-bold">{mockVolunteers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-success/10 p-3">
                <Activity className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('admin.totalActivities')}</p>
                <p className="text-2xl font-bold">{mockSubmissions.filter(s => s.status === 'approved').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-warning/10 p-3">
                <Award className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('admin.pointsAwarded')}</p>
                <p className="text-2xl font-bold">{mockVolunteers.reduce((sum, v) => sum + v.totalPoints, 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('reports.avgPointsPerVolunteer')}</p>
                <p className="text-2xl font-bold">
                  {Math.round(mockVolunteers.reduce((sum, v) => sum + v.totalPoints, 0) / mockVolunteers.length)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity Trend */}
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.activityTrend')}</CardTitle>
            <CardDescription>{t('reports.activityTrendDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="submissions" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name={t('common.submit')}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="approved" 
                    stroke="hsl(var(--success))" 
                    strokeWidth={2}
                    name={t('common.approved')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Level Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.levelDistribution')}</CardTitle>
            <CardDescription>{t('reports.levelDistributionDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={levelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {levelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Committee Performance */}
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.committeePerformance')}</CardTitle>
            <CardDescription>{t('reports.committeePerformanceDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={committeeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={80} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="points" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Activities */}
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.topActivities')}</CardTitle>
            <CardDescription>{t('reports.topActivitiesDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activityStats.map((activity, index) => (
                <div key={activity.name} className="flex items-center gap-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{activity.name}</p>
                    <p className="text-sm text-muted-foreground">{activity.count} • {activity.points} {t('common.points')}</p>
                  </div>
                  <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(activity.count / activityStats[0].count) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>{t('reports.exportData')}</CardTitle>
          <CardDescription>{t('reports.exportDataDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start" onClick={() => handleExport('volunteers')}>
              <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t('reports.volunteerList')}
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => handleExport('activities')}>
              <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t('reports.activityLog')}
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => handleExport('points')}>
              <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t('reports.pointsSummary')}
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => handleExport('monthly')}>
              <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t('reports.monthlyReport')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
