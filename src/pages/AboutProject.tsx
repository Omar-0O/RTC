import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Sparkles,
  Globe,
  Building2,
  Trophy,
  Smartphone,
  UserCheck,
  LayoutDashboard,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import logo from '@/assets/logo.png';

const YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=REPLACE_WITH_VIDEO_ID';
const GITHUB_REPO_URL = 'https://github.com/Omar-0O/RTC';

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
  const [imgError, setImgError] = useState(false);

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-accent/5 to-background border-b py-16 px-4 md:px-8">
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-success/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative group">
              <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-xl scale-125 group-hover:scale-135 transition-transform duration-300" />
              <img
                src={logo}
                alt="RTC Logo"
                className="relative h-24 w-24 rounded-3xl object-cover shadow-2xl border border-white/20 transform group-hover:rotate-3 transition-transform duration-300"
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-indigo-600 to-emerald-600 dark:from-primary dark:via-indigo-400 dark:to-emerald-400">
              {isAr ? 'منصة RTC' : 'RTC Platform'}
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              {isAr
                ? 'نظام متكامل لإدارة المتطوعين، الأنشطة، الكورسات، الفعاليات، وتتبع مشاركات الأعضاء وصناعة الأثر الخيري.'
                : 'A comprehensive system for managing volunteers, activities, courses, events, and tracking member participation.'}
            </p>
          </div>

        </div>
      </div>

      {/* Tabs / Navigation */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10">
        <Tabs defaultValue="team" className="w-full">
          <TabsList className="w-full mb-10 h-13 p-1 bg-muted/60 backdrop-blur rounded-xl grid grid-cols-3 border border-border/50">
            <TabsTrigger value="team" className="gap-2 text-sm py-2.5 rounded-lg transition-all">
              <Users className="h-4 w-4" />
              <span>{isAr ? 'قصة المنصة وفريقها' : 'Our Story & Team'}</span>
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-2 text-sm py-2.5 rounded-lg transition-all">
              <Smartphone className="h-4 w-4" />
              <span>{isAr ? 'كيفية الاستخدام' : 'User Manual'}</span>
            </TabsTrigger>
            <TabsTrigger value="tech" className="gap-2 text-sm py-2.5 rounded-lg transition-all">
              <Code2 className="h-4 w-4" />
              <span>{isAr ? 'المطورين والمستندات' : 'Developer Docs'}</span>
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════════════════════════
              TAB 1 — STORY & TEAM
          ══════════════════════════════════════ */}
          <TabsContent value="team" className="space-y-12 focus-visible:outline-none">
            
            {/* Story Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Heart className="h-5 w-5 fill-primary/20" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">{isAr ? 'قصة وتأسيس المشروع' : 'The Genesis Story'}</h2>
              </div>

              <Card className="border border-border/80 shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6 md:p-8 space-y-6 text-base md:text-lg leading-relaxed text-foreground/90" dir="rtl">
                  <p>
                    تم إنشاء هذا المشروع لخدمة نشاط <span className="font-bold text-primary">RTC</span> الخيري التابع لجمعية رسالة، بهدف تنظيم وتسهيل إدارة شؤون المتطوعين والعمليات الداخلية بدل الاعتماد على الطرق العشوائية أو المتابعة اليدوية.
                  </p>

                  {/* Core Value Pillars Grid */}
                  <div className="grid sm:grid-cols-2 gap-4 py-4">
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-500/5 to-purple-500/10 border border-violet-500/10 flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[15px] mb-1">جمع البيانات بشكل أدق</h4>
                        <p className="text-sm text-muted-foreground leading-normal">تسجيل منظم وتوثيقي لجميع مسارات المتطوع والأنشطة والنسب الشهرية دون ضياع للجهود.</p>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-teal-500/10 border border-emerald-500/10 flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[15px] mb-1">تسهيل إدارة المتطوعين</h4>
                        <p className="text-sm text-muted-foreground leading-normal">منصة رقمية موحدة تمنح كل متطوع القدرة على تسجيل مشاركاته بنفسه ومتابعة تقدمه.</p>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/5 to-orange-500/10 border border-amber-500/10 flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[15px] mb-1">تقليل الوقت والمجهود</h4>
                        <p className="text-sm text-muted-foreground leading-normal">أتمتة حساب نسب الحضور، والdeficit، وتارجت الشهر، وعمليات التصدير للإكسيل بنقرة واحدة.</p>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/10 border border-primary/10 flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                        <Trophy className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[15px] mb-1">التركيز على صناعة الأثر</h4>
                        <p className="text-sm text-muted-foreground leading-normal">توفير الجهد الإداري الضخم ليوجه مباشرة لخدمة المستفيدين وتطوير جودة العمل الخيري.</p>
                      </div>
                    </div>
                  </div>

                  <p>
                    هذا المشروع لم يتم إنشاؤه كمجرد تدريب تقني أو إضافة للسيرة الذاتية، بل بُنيَ بنية أن يكون <span className="font-bold text-primary">صدقة جارية</span>، يستمر نفعها مع الوقت، ويساهم ولو بجزء بسيط في دعم العمل الخيري وتنظيمه وتطويره.
                  </p>

                  <p>
                    كل سطر كود في هذا المشروع كُتب على أمل أن يكون سببًا في تسهيل الخير، ومساعدة من يعملون لأجل الناس دون مقابل.
                  </p>

                  <blockquote className="border-r-4 border-primary/60 pr-5 py-3.5 bg-primary/5 rounded-xl text-right italic font-semibold text-primary/95 shadow-inner">
                    ﴿وَمَا تُقَدِّمُوا لِأَنفُسِكُم مِّنْ خَيْرٍ تَجِدُوهُ عِندَ اللَّهِ﴾ 🤍
                  </blockquote>

                  <p className="pt-2">
                    ولا يفوتني في هذا المقام أن أتقدم بخالص الشكر والتقدير لزميلي وصديقي، <span className="font-bold text-primary">خير الصديق إياد جابر سعد الدين جابر</span>، على دعمه ومساندته الحقيقية طوال فترة العمل على المشروع، فلولاه – بعد فضل الله – ما كان لهذا المشروع أن يخرج إلى النور.
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* Developer Profiles */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500">
                  <Code2 className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">{isAr ? 'فريق التطوير' : 'Development Team'}</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Developer 1 - Omar */}
                <Card className="border border-border/80 bg-card hover:shadow-lg transition-all duration-300 overflow-hidden relative group">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-indigo-500" />
                  <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-start">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary to-indigo-500 blur-sm scale-105 opacity-50" />
                      <div className="relative h-24 w-24 rounded-full bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-white font-extrabold text-3xl border-4 border-background shadow-lg">
                        ع
                      </div>
                    </div>
                    <div className="space-y-2 flex-1 min-w-0">
                      <div>
                        <h3 className="font-bold text-xl">{isAr ? 'عمر' : 'Omar'}</h3>
                        <p className="text-sm font-semibold text-primary mt-0.5">{isAr ? 'مطوّر البرمجيات الرئيسي' : 'Lead Software Developer'}</p>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {isAr ? 'مسؤول عن بناء بنية النظام التقنية والربط مع قاعدة البيانات وتطوير الواجهات.' : 'Responsible for system architecture, database integrations, and core UI development.'}
                      </p>
                      <div className="pt-1">
                        <Button asChild size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-full border-primary/20 hover:border-primary/50">
                          <a href="https://github.com/Omar-0O" target="_blank" rel="noopener noreferrer">
                            <Github className="h-3.5 w-3.5" />
                            <span>@Omar-0O</span>
                            <ExternalLink className="h-2.5 w-2.5 opacity-55" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Developer 2 - Eyad */}
                <Card className="border border-border/80 bg-card hover:shadow-lg transition-all duration-300 overflow-hidden relative group">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-emerald-500" />
                  <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-start">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-500 blur-sm scale-105 opacity-50" />
                      <div className="relative h-24 w-24 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-500 flex items-center justify-center text-white font-extrabold text-3xl border-4 border-background shadow-lg">
                        إ
                      </div>
                    </div>
                    <div className="space-y-2 flex-1 min-w-0">
                      <div>
                        <h3 className="font-bold text-xl">{isAr ? 'إياد جابر' : 'Eyad Jaber'}</h3>
                        <p className="text-sm font-semibold text-indigo-500 mt-0.5">{isAr ? 'مطوّر برمجيات وشريك التأسيس' : 'Software Developer & Co-Founder'}</p>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {isAr ? 'شريك في تصميم وبناء المنصة، مراجعة العمليات، وتقديم الدعم الإداري والتقني الكامل.' : 'Co-designed the platform workflows, reviewed requirements, and provided full technical support.'}
                      </p>
                      <div className="pt-1">
                        <Badge variant="secondary" className="rounded-full text-xs py-0.5 px-3">
                          {isAr ? 'مطور البرمجيات' : 'Software Developer'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Supporters / Branch */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Building2 className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">{isAr ? 'نشاط RTC المهندسين' : 'RTC Mohandseen Supporters'}</h2>
              </div>

              <Card className="border border-border/80 bg-card/40 overflow-hidden">
                <CardContent className="p-6 md:p-8 space-y-6 text-base leading-relaxed text-foreground/90" dir="rtl">
                  <p>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">نشاط RTC المهندسين</span> هو الكيان الخيري والفرع الرائع الذي احتضن هذا المشروع وأعطاه سبب وجوده. وقد كان لفرق هذا النشاط الدور المحوري في دعم فكرة النظام وتجريبه منذ بداياته الأولى.
                  </p>

                  <p>
                    أصحاب الفضل من النشاط الذين آمنوا بالفكرة وصبروا طوال مراحل البناء والاختبار، ولم يبخلوا يومًا بملاحظة أو تشجيع:
                  </p>

                  {/* Team Group Photo Container */}
                  <div className="flex justify-center pt-2">
                    <div className="relative group overflow-hidden rounded-2xl border border-border/60 bg-muted/40 max-w-2xl w-full aspect-[16/9] flex items-center justify-center shadow-md">
                      {!imgError ? (
                        <img 
                          src="/src/assets/group-photo.jpg" 
                          alt="RTC Team Group Photo"
                          className="w-full h-full object-cover rounded-2xl"
                          onError={() => setImgError(true)}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground p-6">
                          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                            RTC
                          </div>
                          <span className="text-sm font-semibold">{isAr ? 'الصورة الجماعية لإدارة نشاط RTC المهندسين' : 'RTC Mohandseen Management Group Photo'}</span>
                          <span className="text-[10px] opacity-60">(/src/assets/group-photo.jpg)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-muted-foreground text-sm text-center pt-4 border-t border-border/40">
                    جزاكم الله خيرًا على كل لحظة دعم وصبر وجعلها في ميزان حسناتكم 🤍
                  </p>
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          {/* ══════════════════════════════════════
              TAB 2 — USER MANUAL
          ══════════════════════════════════════ */}
          <TabsContent value="usage" className="space-y-10 focus-visible:outline-none">
            
            {/* Tutorial Video Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500">
                  <Youtube className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">{isAr ? 'فيديو دليل المنصة' : 'Platform Video Guide'}</h2>
              </div>

              <Card className="border border-red-500/10 bg-gradient-to-br from-red-500/5 to-background shadow-md overflow-hidden">
                <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
                  <div className="relative shrink-0 w-24 h-24 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-xl shadow-red-500/10">
                    <Youtube className="h-12 w-12" />
                  </div>
                  <div className="flex-1 text-center md:text-start space-y-3">
                    <div>
                      <h3 className="font-bold text-xl">{isAr ? 'شرح فيديو عملي متكامل' : 'Step-by-Step Video walkthrough'}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isAr
                          ? 'قمنا بتسجيل فيديو توضيحي يشرح كيفية إضافة المشاركات، إدارتها، وتصدير التقارير لجميع فئات المستخدمين.'
                          : 'A comprehensive walkthrough tutorial demonstrating how to use the platform as a volunteer, supervisor, or HR.'}
                      </p>
                    </div>
                    <div>
                      <Button asChild className="gap-2 bg-red-500 hover:bg-red-600 text-white rounded-full px-6 shadow-lg shadow-red-500/10">
                        <a href={YOUTUBE_VIDEO_URL} target="_blank" rel="noopener noreferrer">
                          <Youtube className="h-4 w-4" />
                          <span>{isAr ? 'مشاهدة الفيديو التعليمي' : 'Watch Tutorial Video'}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Guides for Roles */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">{isAr ? 'دليل المستخدم حسب الصلاحيات' : 'Role-Based Instructions'}</h2>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Volunteer Guide */}
                <Card className="border border-border/70 hover:border-primary/45 transition-colors shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{isAr ? '1. للمتطوعين' : '1. For Volunteers'}</CardTitle>
                    <CardDescription className="text-xs">
                      {isAr ? 'تسجيل ومتابعة النشاط الفردي' : 'Track and submit activities'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <div className="flex gap-2 items-start" dir={isRTL ? 'rtl' : 'ltr'}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{isAr ? 'الدخول عبر الرابط الشخصي المخصص لك.' : 'Access via your unique personal link.'}</span>
                    </div>
                    <div className="flex gap-2 items-start" dir={isRTL ? 'rtl' : 'ltr'}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{isAr ? 'تسجيل المشاركة بتحديد اللجنة وتاريخ العمل.' : 'Submit participations selecting committee & date.'}</span>
                    </div>
                    <div className="flex gap-2 items-start" dir={isRTL ? 'rtl' : 'ltr'}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{isAr ? 'متابعة نقاطك وحالة المشاركات (معلق/مقبول).' : 'Monitor points and approval states.'}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Supervisor Guide */}
                <Card className="border border-border/70 hover:border-indigo-500/40 transition-colors shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="h-10 w-10 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{isAr ? '2. للمشرفين ومسؤولي الفروع' : '2. For Supervisors'}</CardTitle>
                    <CardDescription className="text-xs">
                      {isAr ? 'إدارة حضور اللجان والأنشطة' : 'Manage branch committees'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <div className="flex gap-2 items-start" dir={isRTL ? 'rtl' : 'ltr'}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{isAr ? 'تسجيل المشاركات الجماعية لمتطوعي لجان فرعك.' : 'Log group participations for branch volunteers.'}</span>
                    </div>
                    <div className="flex gap-2 items-start" dir={isRTL ? 'rtl' : 'ltr'}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{isAr ? 'إدارة وتحديث بيانات حلقات القرآن وحضور الكورسات.' : 'Manage Quran circles & course attendance sheets.'}</span>
                    </div>
                    <div className="flex gap-2 items-start" dir={isRTL ? 'rtl' : 'ltr'}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{isAr ? 'اعتماد أو رفض طلبات المشاركة المعلقة.' : 'Approve or reject pending volunteer requests.'}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* HR Guide */}
                <Card className="border border-border/70 hover:border-emerald-500/40 transition-colors shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                      <LayoutDashboard className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{isAr ? '3. لمسؤولي الـ HR' : '3. For HR Teams'}</CardTitle>
                    <CardDescription className="text-xs">
                      {isAr ? 'تتبع التارجت الشهري والعجز' : 'Monitor monthly deficit targets'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <div className="flex gap-2 items-start" dir={isRTL ? 'rtl' : 'ltr'}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{isAr ? 'متابعة نسب حضور وتفاعل متطوعي الفرع.' : 'Track volunteer targets and active statistics.'}</span>
                    </div>
                    <div className="flex gap-2 items-start" dir={isRTL ? 'rtl' : 'ltr'}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{isAr ? 'حساب deficit المشاركات الشهري تلقائياً.' : 'Compute monthly deficits automatically.'}</span>
                    </div>
                    <div className="flex gap-2 items-start" dir={isRTL ? 'rtl' : 'ltr'}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{isAr ? 'إرسال تنبيهات التذكير بالواتساب وتصدير التقارير.' : 'Send reminder WhatsApp messages & export data.'}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          </TabsContent>

          {/* ══════════════════════════════════════
              TAB 3 — TECHNICAL / DEVS
          ══════════════════════════════════════ */}
          <TabsContent value="tech" className="space-y-12 focus-visible:outline-none">
            
            {/* Ongoing Charity Box (In case I am gone) */}
            <Card className="border border-rose-500/20 bg-rose-500/5 relative overflow-hidden">
              <div className="absolute top-0 ltr:right-0 rtl:left-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
              <CardContent className="p-6 md:p-8 space-y-4 text-base leading-relaxed" dir="rtl">
                <div className="flex items-center gap-3">
                  <Heart className="h-5 w-5 text-rose-500 fill-rose-500 shrink-0 animate-pulse" />
                  <h3 className="text-xl font-bold text-rose-600 dark:text-rose-400">في حالة توفاني الله</h3>
                </div>
                <p className="text-foreground/95">
                  هذه الصفحة والملف موجّه لأي مطوّر يرغب في الاستمرار بتشغيل هذا المشروع أو الانطلاق منه لبناء نظام مشابه. الهدف الأساسي هو ضمان استمرار هذه الصدقة الجارية وعدم توقّفها بتوقّف أصحابها.
                </p>
                <p className="text-foreground/80">
                  جميع ما تحتاجه موجود في هذا المستودع (GitHub Repository): قاعدة البيانات كاملة عبر ملفات الـ <span className="font-bold">Migrations</span>، وكود الواجهة البرمجية، والـ Edge Functions، والإعدادات — لا شيء مفقود.
                </p>
                <blockquote className="border-r-4 border-rose-500/60 pr-4 py-1 italic font-semibold text-rose-700 dark:text-rose-300">
                  ﴿وَمَا تُقَدِّمُوا لِأَنفُسِكُم مِّنْ خَيْرٍ تَجِدُوهُ عِندَ اللَّهِ﴾ 🤍
                </blockquote>
              </CardContent>
            </Card>

            {/* Step-by-step installation setup guide */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Terminal className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {isAr ? 'خطوات استنساخ وتشغيل المشروع' : 'Clone & Setup Guide'}
                </h2>
              </div>

              {/* video callout */}
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl border border-border/80 bg-muted/40 gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="flex items-center gap-3">
                  <Youtube className="h-5 w-5 text-red-500 shrink-0" />
                  <p className="text-sm font-semibold">{isAr ? 'فيديو شرح تفصيلي لنسخ وتشغيل الداتابيز' : 'Detailed video guide on how to clone & run database migrations'}</p>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0">
                  <a href={YOUTUBE_VIDEO_URL} target="_blank" rel="noopener noreferrer">
                    <span>{isAr ? 'عرض الشرح' : 'Watch Guide'}</span>
                    {isRTL ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  </a>
                </Button>
              </div>

              {/* Migration Steps Grid */}
              <div className="grid gap-5">
                {migrationSteps.map((s) => (
                  <Card key={s.step} className="border border-border/70 hover:shadow-md transition-shadow duration-300">
                    <CardHeader className="pb-2.5">
                      <CardTitle className="text-base flex items-center gap-3">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                          {s.step}
                        </span>
                        <span>{isAr ? s.title_ar : s.title_en}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative bg-muted rounded-xl p-4 border border-border/50 overflow-hidden">
                        <pre className="text-xs md:text-sm font-mono text-start whitespace-pre-wrap break-words leading-relaxed overflow-x-auto text-muted-foreground dark:text-foreground/90">
                          {s.code}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* GitHub Repo Quick Buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild className="gap-2 bg-foreground text-background hover:bg-foreground/90 shadow-md">
                  <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
                    <Github className="h-4 w-4" />
                    <span>{isAr ? 'مستودع المشروع على GitHub' : 'GitHub Repository'}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <a href={`${GITHUB_REPO_URL}/tree/main/supabase/migrations`} target="_blank" rel="noopener noreferrer">
                    <Database className="h-4 w-4 text-emerald-500" />
                    <span>{isAr ? 'ملفات الـ Migrations' : 'View Migrations'}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </section>

            {/* Tech Stack List */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">{isAr ? 'البنية التكنولوجية للمشروع' : 'Technological Architecture'}</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {techStack.map((tech, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3.5 p-4 rounded-xl border border-border/60 bg-card hover:shadow-md hover:border-primary/25 transition-all duration-300"
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tech.color} flex-shrink-0 shadow-inner flex items-center justify-center text-white font-bold text-xs`} />
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{tech.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{isAr ? tech.desc_ar : tech.desc_en}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
