import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.logActivity': 'Log Activity',
    'nav.leaderboard': 'Leaderboard',
    'nav.profile': 'My Profile',
    'nav.reviewSubmissions': 'Review Submissions',
    'nav.userManagement': 'User Management',
    'nav.committees': 'Committees',
    'nav.activities': 'Activities',
    'nav.reports': 'Reports',
    'nav.navigation': 'Navigation',
    
    // Common
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.submit': 'Submit',
    'common.pending': 'Pending',
    'common.approved': 'Approved',
    'common.rejected': 'Rejected',
    'common.points': 'Points',
    'common.volunteers': 'Volunteers',
    'common.actions': 'Actions',
    'common.all': 'All',
    'common.logout': 'Log out',
    'common.switchTo': 'Switch to',
    'common.volunteer': 'Volunteer',
    'common.supervisor': 'Supervisor',
    'common.admin': 'Admin',
    'common.committeeLeader': 'Committee Leader',
    
    // Committee Leader
    'leader.dashboard': 'Committee Dashboard',
    'leader.overview': 'Manage your committee members and track their progress',
    'leader.myCommittee': 'My Committee',
    'leader.members': 'Committee Members',
    'leader.addMember': 'Add Member',
    'leader.removeMember': 'Remove Member',
    'leader.memberProgress': 'Member Progress',
    'leader.totalMembers': 'Total Members',
    'leader.avgPoints': 'Average Points',
    'leader.topPerformer': 'Top Performer',
    'leader.recentActivities': 'Recent Activities',
    
    // Auth
    'auth.login': 'Login',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.signIn': 'Sign In',
    'auth.welcomeBack': 'Welcome back',
    'auth.loginSubtitle': 'Sign in to your RTC Pulse account',
    'auth.demoAccounts': 'Demo Accounts',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.welcome': 'Welcome back',
    'dashboard.totalPoints': 'Total Points',
    'dashboard.currentRank': 'Current Rank',
    'dashboard.activitiesCompleted': 'Activities Completed',
    'dashboard.currentLevel': 'Current Level',
    'dashboard.recentActivity': 'Recent Activity',
    'dashboard.quickActions': 'Quick Actions',
    'dashboard.logNewActivity': 'Log New Activity',
    'dashboard.viewLeaderboard': 'View Leaderboard',
    
    // Admin Dashboard
    'admin.dashboard': 'Admin Dashboard',
    'admin.overview': 'Overview of RTC Pulse volunteer management system',
    'admin.totalVolunteers': 'Total Volunteers',
    'admin.totalActivities': 'Total Activities',
    'admin.pointsAwarded': 'Points Awarded',
    'admin.pendingReviews': 'Pending Reviews',
    'admin.activeCommittees': 'Active Committees',
    'admin.recentSubmissions': 'Recent Submissions',
    'admin.topVolunteers': 'Top Volunteers',
    'admin.committeePerformance': 'Committee Performance',
    
    // User Management
    'users.title': 'User Management',
    'users.subtitle': 'Manage volunteers, supervisors, and administrators',
    'users.addUser': 'Add User',
    'users.fullName': 'Full Name',
    'users.role': 'Role',
    'users.committee': 'Committee',
    'users.level': 'Level',
    'users.joined': 'Joined',
    'users.viewProfile': 'View Profile',
    'users.sendEmail': 'Send Email',
    'users.deactivate': 'Deactivate User',
    'users.filters': 'Filters',
    'users.searchPlaceholder': 'Search by name or email...',
    'users.filterByRole': 'Filter by role',
    'users.filterByCommittee': 'Filter by committee',
    'users.allRoles': 'All Roles',
    'users.allCommittees': 'All Committees',
    'users.createUser': 'Create a new user account for the system.',
    
    // Committee Management
    'committees.title': 'Committee Management',
    'committees.subtitle': 'Create and manage organization committees',
    'committees.addCommittee': 'Add Committee',
    'committees.createNew': 'Create New Committee',
    'committees.createDescription': 'Add a new committee to the organization.',
    'committees.name': 'Committee Name',
    'committees.description': 'Description',
    'committees.totalPoints': 'Total Points',
    'committees.deleteConfirm': 'Delete Committee?',
    'committees.deleteWarning': 'Are you sure you want to delete this committee? This action cannot be undone. All volunteers in this committee will need to be reassigned.',
    
    // Activity Management
    'activities.title': 'Activity Types',
    'activities.subtitle': 'Manage volunteer activity types and point values',
    'activities.addActivity': 'Add Activity Type',
    'activities.createActivity': 'Create Activity Type',
    'activities.createDescription': 'Define a new type of volunteer activity.',
    'activities.activityName': 'Activity Name',
    'activities.pointsValue': 'Points Value',
    'activities.deleteConfirm': 'Delete Activity Type?',
    'activities.deleteWarning': 'Are you sure you want to delete this activity type? This action cannot be undone.',
    
    // Reports
    'reports.title': 'Reports & Analytics',
    'reports.subtitle': 'Insights into volunteer engagement and activity',
    'reports.exportReport': 'Export Report',
    'reports.thisWeek': 'This Week',
    'reports.thisMonth': 'This Month',
    'reports.thisQuarter': 'This Quarter',
    'reports.thisYear': 'This Year',
    'reports.avgPointsPerVolunteer': 'Avg Points/Volunteer',
    'reports.activityTrend': 'Activity Submissions Trend',
    'reports.activityTrendDesc': 'Monthly submission and approval rates',
    'reports.levelDistribution': 'Volunteer Level Distribution',
    'reports.levelDistributionDesc': 'Breakdown of volunteers by level',
    'reports.committeePerformance': 'Committee Performance',
    'reports.committeePerformanceDesc': 'Points earned by committee',
    'reports.topActivities': 'Top Activities',
    'reports.topActivitiesDesc': 'Most submitted activity types',
    'reports.exportData': 'Export Data',
    'reports.exportDataDesc': 'Download reports in various formats',
    'reports.volunteerList': 'Volunteer List (CSV)',
    'reports.activityLog': 'Activity Log (CSV)',
    'reports.pointsSummary': 'Points Summary (CSV)',
    'reports.monthlyReport': 'Monthly Report (PDF)',
    
    // Leaderboard
    'leaderboard.title': 'Leaderboard',
    'leaderboard.subtitle': 'Top performing volunteers',
    'leaderboard.rank': 'Rank',
    'leaderboard.name': 'Name',
    'leaderboard.global': 'Global',
    
    // Activity Log
    'activityLog.title': 'Log Activity',
    'activityLog.subtitle': 'Submit your volunteer activity for approval',
    'activityLog.selectCommittee': 'Select Committee',
    'activityLog.selectActivity': 'Select Activity',
    'activityLog.mode': 'Mode',
    'activityLog.online': 'Online',
    'activityLog.offline': 'Offline',
    'activityLog.description': 'Description',
    'activityLog.descriptionPlaceholder': 'Describe what you did...',
    'activityLog.proofUrl': 'Proof URL (optional)',
    'activityLog.submitActivity': 'Submit Activity',
    'activityLog.submissionHistory': 'Submission History',
    
    // Profile
    'profile.title': 'My Profile',
    'profile.memberSince': 'Member since',
    'profile.pointsProgress': 'Points Progress',
    'profile.nextLevel': 'Next Level',
    'profile.badges': 'Badges',
    'profile.activityHistory': 'Activity History',
    
    // Levels
    'level.newbie': 'Newbie',
    'level.active': 'Active',
    'level.silver': 'Silver',
    'level.golden': 'Golden',
    
    // App
    'app.name': 'RTC Pulse',
    'app.tagline': 'Volunteer Portal',
    'app.language': 'Language',
  },
  ar: {
    // Navigation
    'nav.dashboard': 'لوحة التحكم',
    'nav.logActivity': 'تسجيل نشاط',
    'nav.leaderboard': 'المتصدرين',
    'nav.profile': 'ملفي الشخصي',
    'nav.reviewSubmissions': 'مراجعة الطلبات',
    'nav.userManagement': 'إدارة المستخدمين',
    'nav.committees': 'اللجان',
    'nav.activities': 'الأنشطة',
    'nav.reports': 'التقارير',
    'nav.navigation': 'التنقل',
    
    // Common
    'common.search': 'بحث',
    'common.filter': 'تصفية',
    'common.add': 'إضافة',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.submit': 'إرسال',
    'common.pending': 'قيد الانتظار',
    'common.approved': 'مقبول',
    'common.rejected': 'مرفوض',
    'common.points': 'نقاط',
    'common.volunteers': 'المتطوعين',
    'common.actions': 'إجراءات',
    'common.all': 'الكل',
    'common.logout': 'تسجيل الخروج',
    'common.switchTo': 'التبديل إلى',
    'common.volunteer': 'متطوع',
    'common.supervisor': 'مشرف',
    'common.admin': 'مسؤول',
    'common.committeeLeader': 'قائد اللجنة',
    
    // Committee Leader
    'leader.dashboard': 'لوحة تحكم اللجنة',
    'leader.overview': 'إدارة أعضاء لجنتك ومتابعة تقدمهم',
    'leader.myCommittee': 'لجنتي',
    'leader.members': 'أعضاء اللجنة',
    'leader.addMember': 'إضافة عضو',
    'leader.removeMember': 'إزالة عضو',
    'leader.memberProgress': 'تقدم الأعضاء',
    'leader.totalMembers': 'إجمالي الأعضاء',
    'leader.avgPoints': 'متوسط النقاط',
    'leader.topPerformer': 'الأفضل أداءً',
    'leader.recentActivities': 'الأنشطة الأخيرة',
    
    // Auth
    'auth.login': 'تسجيل الدخول',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.signIn': 'دخول',
    'auth.welcomeBack': 'مرحباً بعودتك',
    'auth.loginSubtitle': 'سجل دخولك إلى حساب RTC Pulse',
    'auth.demoAccounts': 'حسابات تجريبية',
    
    // Dashboard
    'dashboard.title': 'لوحة التحكم',
    'dashboard.welcome': 'مرحباً بعودتك',
    'dashboard.totalPoints': 'إجمالي النقاط',
    'dashboard.currentRank': 'الترتيب الحالي',
    'dashboard.activitiesCompleted': 'الأنشطة المكتملة',
    'dashboard.currentLevel': 'المستوى الحالي',
    'dashboard.recentActivity': 'النشاط الأخير',
    'dashboard.quickActions': 'إجراءات سريعة',
    'dashboard.logNewActivity': 'تسجيل نشاط جديد',
    'dashboard.viewLeaderboard': 'عرض المتصدرين',
    
    // Admin Dashboard
    'admin.dashboard': 'لوحة تحكم المسؤول',
    'admin.overview': 'نظرة عامة على نظام إدارة المتطوعين RTC Pulse',
    'admin.totalVolunteers': 'إجمالي المتطوعين',
    'admin.totalActivities': 'إجمالي الأنشطة',
    'admin.pointsAwarded': 'النقاط الممنوحة',
    'admin.pendingReviews': 'المراجعات المعلقة',
    'admin.activeCommittees': 'اللجان النشطة',
    'admin.recentSubmissions': 'الطلبات الأخيرة',
    'admin.topVolunteers': 'أفضل المتطوعين',
    'admin.committeePerformance': 'أداء اللجان',
    
    // User Management
    'users.title': 'إدارة المستخدمين',
    'users.subtitle': 'إدارة المتطوعين والمشرفين والمسؤولين',
    'users.addUser': 'إضافة مستخدم',
    'users.fullName': 'الاسم الكامل',
    'users.role': 'الدور',
    'users.committee': 'اللجنة',
    'users.level': 'المستوى',
    'users.joined': 'تاريخ الانضمام',
    'users.viewProfile': 'عرض الملف',
    'users.sendEmail': 'إرسال بريد',
    'users.deactivate': 'إلغاء التفعيل',
    'users.filters': 'التصفية',
    'users.searchPlaceholder': 'البحث بالاسم أو البريد...',
    'users.filterByRole': 'تصفية حسب الدور',
    'users.filterByCommittee': 'تصفية حسب اللجنة',
    'users.allRoles': 'جميع الأدوار',
    'users.allCommittees': 'جميع اللجان',
    'users.createUser': 'إنشاء حساب مستخدم جديد في النظام.',
    
    // Committee Management
    'committees.title': 'إدارة اللجان',
    'committees.subtitle': 'إنشاء وإدارة لجان المنظمة',
    'committees.addCommittee': 'إضافة لجنة',
    'committees.createNew': 'إنشاء لجنة جديدة',
    'committees.createDescription': 'إضافة لجنة جديدة للمنظمة.',
    'committees.name': 'اسم اللجنة',
    'committees.description': 'الوصف',
    'committees.totalPoints': 'إجمالي النقاط',
    'committees.deleteConfirm': 'حذف اللجنة؟',
    'committees.deleteWarning': 'هل أنت متأكد من حذف هذه اللجنة؟ لا يمكن التراجع عن هذا الإجراء. سيحتاج جميع المتطوعين في هذه اللجنة إلى إعادة تعيين.',
    
    // Activity Management
    'activities.title': 'أنواع الأنشطة',
    'activities.subtitle': 'إدارة أنواع أنشطة المتطوعين وقيم النقاط',
    'activities.addActivity': 'إضافة نوع نشاط',
    'activities.createActivity': 'إنشاء نوع نشاط',
    'activities.createDescription': 'تحديد نوع جديد من أنشطة التطوع.',
    'activities.activityName': 'اسم النشاط',
    'activities.pointsValue': 'قيمة النقاط',
    'activities.deleteConfirm': 'حذف نوع النشاط؟',
    'activities.deleteWarning': 'هل أنت متأكد من حذف نوع النشاط هذا؟ لا يمكن التراجع عن هذا الإجراء.',
    
    // Reports
    'reports.title': 'التقارير والتحليلات',
    'reports.subtitle': 'رؤى حول مشاركة المتطوعين والنشاط',
    'reports.exportReport': 'تصدير التقرير',
    'reports.thisWeek': 'هذا الأسبوع',
    'reports.thisMonth': 'هذا الشهر',
    'reports.thisQuarter': 'هذا الربع',
    'reports.thisYear': 'هذا العام',
    'reports.avgPointsPerVolunteer': 'متوسط النقاط/متطوع',
    'reports.activityTrend': 'اتجاه تقديم الأنشطة',
    'reports.activityTrendDesc': 'معدلات التقديم والموافقة الشهرية',
    'reports.levelDistribution': 'توزيع مستويات المتطوعين',
    'reports.levelDistributionDesc': 'تفصيل المتطوعين حسب المستوى',
    'reports.committeePerformance': 'أداء اللجان',
    'reports.committeePerformanceDesc': 'النقاط المكتسبة حسب اللجنة',
    'reports.topActivities': 'أفضل الأنشطة',
    'reports.topActivitiesDesc': 'أكثر أنواع الأنشطة تقديماً',
    'reports.exportData': 'تصدير البيانات',
    'reports.exportDataDesc': 'تنزيل التقارير بتنسيقات مختلفة',
    'reports.volunteerList': 'قائمة المتطوعين (CSV)',
    'reports.activityLog': 'سجل الأنشطة (CSV)',
    'reports.pointsSummary': 'ملخص النقاط (CSV)',
    'reports.monthlyReport': 'التقرير الشهري (PDF)',
    
    // Leaderboard
    'leaderboard.title': 'المتصدرين',
    'leaderboard.subtitle': 'أفضل المتطوعين أداءً',
    'leaderboard.rank': 'الترتيب',
    'leaderboard.name': 'الاسم',
    'leaderboard.global': 'عام',
    
    // Activity Log
    'activityLog.title': 'تسجيل نشاط',
    'activityLog.subtitle': 'قدم نشاطك التطوعي للموافقة',
    'activityLog.selectCommittee': 'اختر اللجنة',
    'activityLog.selectActivity': 'اختر النشاط',
    'activityLog.mode': 'الوضع',
    'activityLog.online': 'عن بعد',
    'activityLog.offline': 'حضوري',
    'activityLog.description': 'الوصف',
    'activityLog.descriptionPlaceholder': 'صف ما فعلته...',
    'activityLog.proofUrl': 'رابط الإثبات (اختياري)',
    'activityLog.submitActivity': 'تقديم النشاط',
    'activityLog.submissionHistory': 'سجل التقديمات',
    
    // Profile
    'profile.title': 'ملفي الشخصي',
    'profile.memberSince': 'عضو منذ',
    'profile.pointsProgress': 'تقدم النقاط',
    'profile.nextLevel': 'المستوى التالي',
    'profile.badges': 'الشارات',
    'profile.activityHistory': 'سجل النشاط',
    
    // Levels
    'level.newbie': 'مبتدئ',
    'level.active': 'نشط',
    'level.silver': 'فضي',
    'level.golden': 'ذهبي',
    
    // App
    'app.name': 'RTC Pulse',
    'app.tagline': 'بوابة المتطوعين',
    'app.language': 'اللغة',
  },
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('rtc-language');
    return (saved as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('rtc-language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  const isRTL = language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRTL]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
