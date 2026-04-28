import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BarChart3, FileSpreadsheet, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ExecutiveDashboard() {
  const { primaryRole } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const ar = (ar: string, en: string) => language === 'ar' ? ar : en;

  // Guard: only executive can access this page
  useEffect(() => {
    if (primaryRole !== 'executive') {
      navigate('/dashboard', { replace: true });
    }
  }, [primaryRole, navigate]);

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {ar('لوحة المدير التنفيذي', 'Executive Dashboard')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {ar('عرض بيانات ومؤشرات الأداء لجميع الفروع', 'View performance data and KPIs across all branches')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-primary" />
              {ar('التقارير', 'Reports')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {ar('عرض وتصدير تقارير المشاركات والإحصاءات لجميع الفروع', 'View and export participation reports and statistics for all branches')}
            </p>
            <Button asChild className="w-full mt-2">
              <Link to="/executive/reports">
                <FileSpreadsheet className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {ar('فتح التقارير', 'Open Reports')}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="opacity-60 cursor-not-allowed">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              {ar('مؤشرات الأداء', 'KPI Dashboard')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {ar('قريباً — إحصاءات مقارنة بين الفروع', 'Coming soon — cross-branch comparison analytics')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
