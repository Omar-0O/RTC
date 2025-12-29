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
import { toast } from 'sonner';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Reports() {
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
    { name: 'Newbie', value: mockVolunteers.filter(v => v.level === 'Newbie').length, color: 'hsl(var(--level-newbie))' },
    { name: 'Active', value: mockVolunteers.filter(v => v.level === 'Active').length, color: 'hsl(var(--level-active))' },
    { name: 'Silver', value: mockVolunteers.filter(v => v.level === 'Silver').length, color: 'hsl(var(--level-silver))' },
    { name: 'Golden', value: mockVolunteers.filter(v => v.level === 'Golden').length, color: 'hsl(var(--level-golden))' },
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
    toast.success(`Exporting ${type} report...`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">Insights into volunteer engagement and activity</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handleExport('full')}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
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
                <p className="text-sm text-muted-foreground">Total Volunteers</p>
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
                <p className="text-sm text-muted-foreground">Total Activities</p>
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
                <p className="text-sm text-muted-foreground">Points Awarded</p>
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
                <p className="text-sm text-muted-foreground">Avg Points/Volunteer</p>
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
            <CardTitle>Activity Submissions Trend</CardTitle>
            <CardDescription>Monthly submission and approval rates</CardDescription>
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
                    name="Submissions"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="approved" 
                    stroke="hsl(var(--success))" 
                    strokeWidth={2}
                    name="Approved"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Level Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Volunteer Level Distribution</CardTitle>
            <CardDescription>Breakdown of volunteers by level</CardDescription>
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
            <CardTitle>Committee Performance</CardTitle>
            <CardDescription>Points earned by committee</CardDescription>
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
            <CardTitle>Top Activities</CardTitle>
            <CardDescription>Most submitted activity types</CardDescription>
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
                    <p className="text-sm text-muted-foreground">{activity.count} submissions • {activity.points} pts each</p>
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
          <CardTitle>Export Data</CardTitle>
          <CardDescription>Download reports in various formats</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start" onClick={() => handleExport('volunteers')}>
              <Download className="mr-2 h-4 w-4" />
              Volunteer List (CSV)
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => handleExport('activities')}>
              <Download className="mr-2 h-4 w-4" />
              Activity Log (CSV)
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => handleExport('points')}>
              <Download className="mr-2 h-4 w-4" />
              Points Summary (CSV)
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => handleExport('monthly')}>
              <Download className="mr-2 h-4 w-4" />
              Monthly Report (PDF)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
