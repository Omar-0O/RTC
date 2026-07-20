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
  Sparkles,
  Globe,
  ImageIcon,
  Building2,
} from 'lucide-react';
import logo from '@/assets/logo.webp';

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
    code: `# أنشئ ملف .env في جذر المشروع\n# Create a .env file in the project root\n\nVITE_SUPABASE_URL=your_supabase_url\nVITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key`,
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

// Photo placeholder component
function PhotoPlaceholder({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground/50 ${className}`}
    >
      <ImageIcon className="h-8 w-8" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

export default function AboutProject() {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div
          className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}
        />
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
              <Heart className="h-4 w-4" />
              {isAr ? 'في حالة توفاني الله' : 'If I\'m Gone'}
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════════════════════════
              TAB 1 — TEAM
          ══════════════════════════════════════ */}
          <TabsContent value="team" className="space-y-10 mt-0">

            {/* Project Story */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold">{isAr ? 'قصة المشروع' : 'Project Story'}</h2>
              </div>

              <Card className="border-primary/10">
                <CardContent className="pt-6 space-y-6 text-[15px] leading-loose text-foreground/90" dir="rtl">

                  <p>
                    تم إنشاء هذا المشروع لخدمة نشاط <span className="font-semibold text-primary">RTC</span> الخيري التابع لجمعية رسالة،
                    بهدف تنظيم وتسهيل إدارة شؤون المتطوعين والعمليات الداخلية بدل الاعتماد على الطرق العشوائية أو المتابعة اليدوية.
                  </p>

                  {/* Image placeholder #1 */}
                  <PhotoPlaceholder label="صورة توضيحية — النشاط" className="w-full h-48" />

                  <p>
                    جاءت فكرة المشروع من الحاجة إلى نظام واضح ومنظم يساعد فريق العمل على:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-foreground/80 pr-4">
                    <li>جمع البيانات بشكل أدق</li>
                    <li>تسهيل إدارة المتطوعين</li>
                    <li>تقليل الوقت والمجهود المبذول في المتابعة</li>
                    <li>التركيز أكثر على الهدف الأساسي وهو خدمة الناس وصناعة أثر حقيقي</li>
                  </ul>

                  {/* Image placeholder #2 */}
                  <PhotoPlaceholder label="صورة — لقطة من واجهة المنصة" className="w-full h-52" />

                  <p>
                    هذا المشروع لم يتم إنشاؤه كمجرد تدريب تقني أو إضافة للسيرة الذاتية،
                    بل بُنيَ بنية أن يكون <span className="font-semibold">صدقة جارية</span>، يستمر نفعها مع الوقت،
                    ويساهم ولو بجزء بسيط في دعم العمل الخيري وتنظيمه وتطويره.
                  </p>

                  <p>
                    كل سطر كود في هذا المشروع كُتب على أمل أن يكون سببًا في تسهيل الخير،
                    ومساعدة من يعملون لأجل الناس دون مقابل.
                  </p>

                  <blockquote className="border-r-4 border-primary/60 pr-4 py-2 bg-primary/5 rounded-lg text-right italic font-medium text-primary">
                    ﴿وَمَا تُقَدِّمُوا لِأَنفُسِكُم مِّنْ خَيْرٍ تَجِدُوهُ عِندَ اللَّهِ﴾ 🤍
                  </blockquote>

                  <p>
                    ولا يفوتني في هذا المقام أن أتقدم بخالص الشكر والتقدير لزميلي وصديقي،
                    <span className="font-semibold text-primary"> خير الصديق إياد جابر سعد الدين جابر</span>،
                    على دعمه ومساندته الحقيقية طوال فترة العمل على المشروع،
                    فلولاه – بعد فضل الله – ما كان لهذا المشروع أن يخرج إلى النور.
                  </p>

                </CardContent>
              </Card>
            </section>

            {/* Developers */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-indigo-500/10">
                  <Code2 className="h-5 w-5 text-indigo-500" />
                </div>
                <h2 className="text-xl font-bold">{isAr ? 'فريق التطوير' : 'Development Team'}</h2>
              </div>

              <Card className="border-indigo-500/20">
                <CardContent className="pt-6">
                  <div className="grid sm:grid-cols-2 gap-8">
                    {/* Developer 1 — Omar */}
                    <div className="flex flex-col items-center gap-4 text-center">
                      <PhotoPlaceholder label="صورة — عمر" className="w-36 h-36 rounded-full" />
                      <div>
                        <p className="font-bold text-lg">عمر</p>
                        <p className="text-sm text-muted-foreground mb-2">مطوّر البرمجيات</p>
                        <a
                          href="https://github.com/Omar-0O"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                          <Github className="h-3 w-3" />
                          @Omar-0O
                        </a>
                      </div>
                    </div>

                    {/* Developer 2 — Eyad */}
                    <div className="flex flex-col items-center gap-4 text-center">
                      <PhotoPlaceholder label="صورة — إياد" className="w-36 h-36 rounded-full" />
                      <div>
                        <p className="font-bold text-lg">إياد جابر</p>
                        <p className="text-sm text-muted-foreground mb-2">مطوّر البرمجيات</p>
                      </div>
                    </div>
                  </div>

                  {/* Team photo placeholder */}
                  <div className="mt-8">
                    <PhotoPlaceholder label="صورة جماعية — فريق التطوير" className="w-full h-52" />
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* RTC Mohandseen Branch — Supporters */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Building2 className="h-5 w-5 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold">{isAr ? 'نشاط RTC المهندسين' : 'RTC Mohandseen Branch'}</h2>
              </div>

              <Card className="border-emerald-500/20">
                <CardContent className="pt-6 space-y-6 text-[15px] leading-loose text-foreground/90" dir="rtl">

                  <p>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">نشاط RTC المهندسين</span> هو النشاط
                    الذي احتضن هذا المشروع وأعطاه سبب وجوده. وقد كان لفريق النشاط دور محوري في دعم فكرة المشروع
                    منذ بداياتها الأولى.
                  </p>

                  {/* Image placeholder — Branch */}
                  <PhotoPlaceholder label="صورة — نشاط RTC المهندسين" className="w-full h-52" />

                  <p>
                    أصحاب الفضل من فريق النشاط الذين آمنوا بالفكرة، وصبروا على فريق التطوير طوال مراحل البناء
                    والاختبار والتعديل، ولم يبخلوا يومًا بملاحظة أو فكرة أو تشجيع.
                  </p>



                </CardContent>
              </Card>
            </section>

          </TabsContent>

          {/* ══════════════════════════════════════
              TAB 2 — HOW TO USE
          ══════════════════════════════════════ */}
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


          </TabsContent>

          {/* ══════════════════════════════════════
              TAB 3 — في حالة توفاني الله
          ══════════════════════════════════════ */}
          <TabsContent value="tech" className="space-y-10 mt-0">

            {/* Intro */}
            <Card className="border-rose-500/20 bg-rose-500/5">
              <CardContent className="pt-6 pb-6 space-y-4 text-[15px] leading-loose" dir="rtl">
                <div className="flex items-center gap-3 mb-2">
                  <Heart className="h-5 w-5 text-rose-500 fill-rose-500 flex-shrink-0" />
                  <h2 className="text-lg font-bold text-rose-600 dark:text-rose-400">في حالة توفاني الله</h2>
                </div>
                <p className="text-foreground/90">
                  هذه الصفحة موجّهة لأي مطوّر يرغب في الاستمرار بتشغيل هذا المشروع أو الانطلاق منه لبناء نظام مشابه.
                  الهدف الأساسي هو ضمان استمرار هذه الصدقة الجارية وعدم توقّفها بتوقّف أصحابها.
                </p>
                <p className="text-foreground/80">
                  جميع ما تحتاجه موجود في هذا الريبو:
                  قاعدة البيانات كاملة عبر الـ <span className="font-semibold">Migrations</span>،
                  وكود الواجهة، والـ Edge Functions، والإعدادات — لا شيء مفقود.
                </p>
                <blockquote className="border-r-4 border-rose-400 pr-4 py-1 italic font-medium text-rose-700 dark:text-rose-300">
                  ﴿وَمَا تُقَدِّمُوا لِأَنفُسِكُم مِّنْ خَيْرٍ تَجِدُوهُ عِندَ اللَّهِ﴾ 🤍
                </blockquote>
              </CardContent>
            </Card>

            {/* Fork & Setup Guide */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Terminal className="h-5 w-5 text-green-500" />
                </div>
                <h2 className="text-xl font-bold">
                  {isAr ? 'خطوات نسخ المشروع وإعداد داتابيز جديدة' : 'Fork & Setup a New Database'}
                </h2>
              </div>

              {/* YouTube link */}
              <Card className="mb-5 border-red-500/20 bg-red-500/5 hover:border-red-500/40 transition-colors">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <Youtube className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0" dir="rtl">
                      <p className="font-medium text-sm mb-0.5">فيديو شرح كيفية النسخ والإعداد</p>
                      <p className="text-xs text-muted-foreground">شاهد الفيديو لفهم الخطوات بشكل تفصيلي قبل البدء</p>
                    </div>
                    <Button asChild size="sm" className="gap-2 bg-red-500 hover:bg-red-600 text-white flex-shrink-0">
                      <a href={YOUTUBE_VIDEO_URL} target="_blank" rel="noopener noreferrer">
                        <Youtube className="h-3.5 w-3.5" />
                        {isAr ? 'مشاهدة' : 'Watch'}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
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

            {/* Tech Stack */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <BookOpen className="h-5 w-5 text-purple-500" />
                </div>
                <h2 className="text-xl font-bold">{isAr ? 'التقنيات المستخدمة في المشروع' : 'Tech Stack'}</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-5" dir="rtl">
                إليك قائمة بكل التقنيات المستخدمة لتساعدك على فهم البنية التقنية للمشروع قبل البدء.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {techStack.map((tech, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3.5 rounded-lg border hover:shadow-sm transition-all hover:border-primary/30"
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tech.color} flex-shrink-0 shadow-sm`} />
                    <div>
                      <p className="font-medium text-sm">{tech.name}</p>
                      <p className="text-xs text-muted-foreground">{isAr ? tech.desc_ar : tech.desc_en}</p>
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
