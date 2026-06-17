import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Github,
  Youtube,
  Database,
  Heart,
  Code2,
  Users,
  ExternalLink,
  Terminal,
  BookOpen,
  Star,
  Sparkles,
  Globe,
} from 'lucide-react';
import logo from '@/assets/logo.png';

const YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=REPLACE_WITH_VIDEO_ID';
const GITHUB_REPO_URL = 'https://github.com/Omar-0O/RTC';

const creators = [
  {
    name_ar: 'عمر',
    name_en: 'Omar',
    role_ar: 'المطور الرئيسي',
    role_en: 'Lead Developer',
    github: 'Omar-0O',
  },
];

const contributors: { name_ar: string; name_en: string; role_ar: string; role_en: string }[] = [
  // أضف أسماء المساهمين هنا
  // { name_ar: 'اسم المساهم', name_en: 'Contributor Name', role_ar: 'الدور', role_en: 'Role' },
];

const supervisors: { name_ar: string; name_en: string; title_ar: string; title_en: string }[] = [
  // أضف أسماء المشرفين هنا
  // { name_ar: 'اسم المشرف', name_en: 'Supervisor Name', title_ar: 'اللقب', title_en: 'Title' },
];

const migrationSteps = [
  {
    step: 1,
    title_ar: 'استنساخ المشروع',
    title_en: 'Clone the Repository',
    code: `git clone ${GITHUB_REPO_URL}\ncd RTC`,
  },
  {
    step: 2,
    title_ar: 'تثبيت المتطلبات',
    title_en: 'Install Dependencies',
    code: `npm install\n# أو / or\nbun install`,
  },
  {
    step: 3,
    title_ar: 'إنشاء مشروع Supabase جديد',
    title_en: 'Create a New Supabase Project',
    code: `# اذهب إلى supabase.com وأنشئ مشروعاً جديداً\n# Go to supabase.com and create a new project`,
  },
  {
    step: 4,
    title_ar: 'إعداد متغيرات البيئة',
    title_en: 'Setup Environment Variables',
    code: `# أنشئ ملف .env في جذر المشروع\n# Create a .env file in the project root\n\nVITE_SUPABASE_URL=your_supabase_url\nVITE_SUPABASE_ANON_KEY=your_supabase_anon_key`,
  },
  {
    step: 5,
    title_ar: 'تشغيل الـ Migrations',
    title_en: 'Run the Migrations',
    code: `# تأكد من تثبيت Supabase CLI\n# Make sure Supabase CLI is installed\n\nsupabase login\nsupabase link --project-ref YOUR_PROJECT_REF\nsupabase db push`,
  },
  {
    step: 6,
    title_ar: 'تشغيل المشروع',
    title_en: 'Run the Project',
    code: `npm run dev\n# أو / or\nbun dev`,
  },
];

const techStack = [
  { name: 'React 18', desc_ar: 'مكتبة واجهة المستخدم', desc_en: 'UI Library', color: 'from-cyan-500 to-blue-500' },
  { name: 'TypeScript', desc_ar: 'لغة البرمجة', desc_en: 'Programming Language', color: 'from-blue-600 to-indigo-600' },
  { name: 'Supabase', desc_ar: 'قاعدة البيانات والـ backend', desc_en: 'Database & Backend', color: 'from-green-500 to-emerald-600' },
  { name: 'Vite', desc_ar: 'أداة البناء', desc_en: 'Build Tool', color: 'from-purple-500 to-violet-600' },
  { name: 'Tailwind CSS', desc_ar: 'تصميم الواجهة', desc_en: 'Styling', color: 'from-sky-500 to-cyan-500' },
  { name: 'shadcn/ui', desc_ar: 'مكتبة المكونات', desc_en: 'Component Library', color: 'from-gray-600 to-gray-700' },
  { name: 'React Router v6', desc_ar: 'التوجيه والتنقل', desc_en: 'Routing', color: 'from-red-500 to-rose-600' },
  { name: 'TanStack Query', desc_ar: 'إدارة البيانات', desc_en: 'Data Management', color: 'from-orange-500 to-amber-500' },
  { name: 'Recharts', desc_ar: 'الرسوم البيانية', desc_en: 'Charts', color: 'from-pink-500 to-rose-500' },
  { name: 'PostgreSQL', desc_ar: 'قاعدة البيانات', desc_en: 'Database Engine', color: 'from-blue-700 to-blue-900' },
  { name: 'Row Level Security', desc_ar: 'أمان البيانات', desc_en: 'Data Security', color: 'from-yellow-500 to-orange-500' },
  { name: 'Edge Functions', desc_ar: 'دوال الخادم', desc_en: 'Server Functions', color: 'from-teal-500 to-green-600' },
];

export default function AboutProject() {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="relative max-w-5xl mx-auto px-6 py-14 text-center">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-2xl scale-150" />
              <img src={logo} alt="RTC Logo" className="relative h-20 w-20 rounded-2xl object-cover shadow-2xl" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
            {isAr ? 'منصة RTC' : 'RTC Platform'}
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto mb-5">
            {isAr
              ? 'نظام متكامل لإدارة المتطوعين، الأنشطة، الكورسات، الفعاليات، وتتبع مشاركات الأعضاء'
              : 'A comprehensive system for managing volunteers, activities, courses, events, and tracking member participation'}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Badge variant="secondary" className="text-sm py-1 px-3 gap-1">
              <Sparkles className="h-3 w-3" />
              React + TypeScript
            </Badge>
            <Badge variant="secondary" className="text-sm py-1 px-3 gap-1">
              <Database className="h-3 w-3" />
              Supabase
            </Badge>
            <Badge variant="secondary" className="text-sm py-1 px-3 gap-1">
              <Globe className="h-3 w-3" />
              {isAr ? 'متعدد اللغات' : 'Multilingual'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Tabs defaultValue="team" className="w-full">
          <TabsList className="w-full mb-8 h-12 grid grid-cols-3">
            <TabsTrigger value="team" className="gap-2 text-sm">
              <Users className="h-4 w-4" />
              {isAr ? 'الفريق' : 'Team'}
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-2 text-sm">
              <Youtube className="h-4 w-4" />
              {isAr ? 'كيفية الاستخدام' : 'How to Use'}
            </TabsTrigger>
            <TabsTrigger value="tech" className="gap-2 text-sm">
              <Code2 className="h-4 w-4" />
              {isAr ? 'التقنيات' : 'Tech Stack'}
            </TabsTrigger>
          </TabsList>

          {/* ── TAB 1: Team ── */}
          <TabsContent value="team" className="space-y-10 mt-0">

            {/* Creators */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Code2 className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold">{isAr ? 'من صنع هذا المشروع؟' : 'Who Built This?'}</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {creators.map((c, i) => (
                  <Card key={i} className="border-primary/20 hover:border-primary/50 transition-colors hover:shadow-md">
                    <CardContent className="pt-6 text-center">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-3 text-primary-foreground font-bold text-xl">
                        {(isAr ? c.name_ar : c.name_en)[0]}
                      </div>
                      <p className="font-semibold text-foreground">{isAr ? c.name_ar : c.name_en}</p>
                      <p className="text-sm text-muted-foreground mb-3">{isAr ? c.role_ar : c.role_en}</p>
                      {c.github && (
                        <a
                          href={`https://github.com/${c.github}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                          <Github className="h-3 w-3" />
                          @{c.github}
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Contributors */}
            {contributors.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Star className="h-5 w-5 text-amber-500" />
                  </div>
                  <h2 className="text-xl font-bold">{isAr ? 'المساهمون' : 'Contributors'}</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {contributors.map((c, i) => (
                    <Card key={i} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-3 text-white font-bold text-lg">
                          {(isAr ? c.name_ar : c.name_en)[0]}
                        </div>
                        <p className="font-semibold">{isAr ? c.name_ar : c.name_en}</p>
                        <p className="text-sm text-muted-foreground">{isAr ? c.role_ar : c.role_en}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Supervisors */}
            {supervisors.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <h2 className="text-xl font-bold">{isAr ? 'المشرفون' : 'Supervisors'}</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {supervisors.map((s, i) => (
                    <Card key={i} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center mx-auto mb-3 text-white font-bold text-lg">
                          {(isAr ? s.name_ar : s.name_en)[0]}
                        </div>
                        <p className="font-semibold">{isAr ? s.name_ar : s.name_en}</p>
                        <p className="text-sm text-muted-foreground">{isAr ? s.title_ar : s.title_en}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state if no contributors/supervisors */}
            {contributors.length === 0 && supervisors.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Heart className="h-8 w-8 mx-auto mb-3 text-red-400 fill-red-400" />
                {isAr ? 'صُنع بـ ❤️ لخدمة العمل التطوعي' : 'Made with ❤️ for volunteering'}
              </div>
            )}
          </TabsContent>

          {/* ── TAB 2: Usage ── */}
          <TabsContent value="usage" className="space-y-8 mt-0">

            {/* Video */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Youtube className="h-5 w-5 text-red-500" />
                </div>
                <h2 className="text-xl font-bold">{isAr ? 'فيديو شرح المنصة' : 'Platform Tutorial Video'}</h2>
              </div>
              <Card className="border-red-500/20 hover:border-red-500/40 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <Youtube className="h-10 w-10 text-red-500" />
                    </div>
                    <div className="flex-1 text-center sm:text-start">
                      <p className="font-semibold text-lg mb-1">
                        {isAr ? 'فيديو شرح المنصة' : 'Platform Tutorial Video'}
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {isAr
                          ? 'شاهد الفيديو لتتعلم كيفية استخدام جميع مميزات المنصة خطوة بخطوة'
                          : 'Watch the video to learn how to use all platform features step by step'}
                      </p>
                      <Button asChild className="gap-2 bg-red-500 hover:bg-red-600 text-white">
                        <a href={YOUTUBE_VIDEO_URL} target="_blank" rel="noopener noreferrer">
                          <Youtube className="h-4 w-4" />
                          {isAr ? 'مشاهدة الفيديو' : 'Watch Video'}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Fork & Setup Guide */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Terminal className="h-5 w-5 text-green-500" />
                </div>
                <h2 className="text-xl font-bold">
                  {isAr ? 'كيفية نسخ المشروع وإعداد داتابيز جديدة' : 'Fork & Setup a New Database'}
                </h2>
              </div>

              <Card className="mb-5 border-amber-500/20 bg-amber-500/5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex gap-2 items-start">
                    <Heart className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      {isAr
                        ? 'هذه التعليمات موجودة حتى يتمكن أي شخص من الاستمرار في تشغيل المشروع وتطويره في أي وقت. جميع الـ migrations موجودة في مجلد supabase/migrations داخل الريبو.'
                        : 'These instructions exist so anyone can continue running and developing the project at any time. All migrations are located in the supabase/migrations folder within the repo.'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {migrationSteps.map((s) => (
                  <Card key={s.step} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-3">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                          {s.step}
                        </span>
                        {isAr ? s.title_ar : s.title_en}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto text-start whitespace-pre-wrap break-words leading-relaxed">
                        {s.code}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild variant="outline" className="gap-2">
                  <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
                    <Github className="h-4 w-4" />
                    {isAr ? 'الريبو على GitHub' : 'GitHub Repository'}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <a href={`${GITHUB_REPO_URL}/tree/main/supabase/migrations`} target="_blank" rel="noopener noreferrer">
                    <Database className="h-4 w-4" />
                    {isAr ? 'عرض الـ Migrations' : 'View Migrations'}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </section>
          </TabsContent>

          {/* ── TAB 3: Tech Stack ── */}
          <TabsContent value="tech" className="mt-0">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <BookOpen className="h-5 w-5 text-purple-500" />
              </div>
              <h2 className="text-xl font-bold">{isAr ? 'التقنيات المستخدمة' : 'Tech Stack'}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {techStack.map((tech, i) => (
                <div key={i} className="flex items-center gap-3 p-3.5 rounded-lg border hover:shadow-sm transition-all hover:border-primary/30">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tech.color} flex-shrink-0 shadow-sm`} />
                  <div>
                    <p className="font-medium text-sm">{tech.name}</p>
                    <p className="text-xs text-muted-foreground">{isAr ? tech.desc_ar : tech.desc_en}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center py-8 mt-4 border-t">
          <p className="text-muted-foreground text-sm flex items-center justify-center gap-1.5">
            {isAr ? 'صُنع بـ' : 'Made with'}
            <Heart className="h-4 w-4 text-red-500 fill-red-500" />
            {isAr ? 'لخدمة العمل التطوعي' : 'for volunteering'}
          </p>
        </div>
      </div>
    </div>
  );
}
