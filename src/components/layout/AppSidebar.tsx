import {
  Home,
  Activity,
  Trophy,
  User,
  ClipboardCheck,
  Settings,
  Users,
  BarChart3,
  LogOut,
  ChevronDown,
  Languages,
  Building2,
  Bus,
  Calendar,
  GraduationCap,
  FileCheck,
  UserCheck,
  Award,
  PhoneCall,
  BookOpen,
  Sun,
  Moon,
  Laptop
} from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import logo from '@/assets/logo.png';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

export function AppSidebar() {
  const { user, profile, signOut, primaryRole } = useAuth();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const { setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';

  // Close mobile sidebar when navigation item is clicked
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  const [isCourseAccess, setIsCourseAccess] = useState(false);
  const [isCircleOrganizer, setIsCircleOrganizer] = useState(false);

  // Check if user is a course organizer
  useEffect(() => {
    const checkCourseAccess = async () => {
      if (!user?.id) return;

      // Check if organizer
      const { data: organizerData } = await supabase
        .from('course_organizers')
        .select('id')
        .eq('volunteer_id', user.id)
        .limit(1);

      if (organizerData && organizerData.length > 0) {
        setIsCourseAccess(true);
        return;
      }

      // Check if marketer
      const { data: marketerData } = await supabase
        .from('course_marketers')
        .select('id')
        .eq('volunteer_id', user.id)
        .limit(1);

      setIsCourseAccess(marketerData && marketerData.length > 0);
    };
    checkCourseAccess();

    // Check if user is a circle organizer OR enrolled in a circle
    const checkCircleOrganizer = async () => {
      if (!user?.id) return;

      // Check if organizer
      const { data: organizerData } = await supabase
        .from('quran_circle_organizers')
        .select('id')
        .eq('volunteer_id', user.id)
        .limit(1);

      if (organizerData && organizerData.length > 0) {
        setIsCircleOrganizer(true);
        return;
      }

      // Check if enrolled in any circle (as a beneficiary linked to volunteer)
      // FIXME: Schema update needed. quran_beneficiaries table does not have volunteer_id.
      // const { data: enrollmentData } = await supabase
      //   .from('quran_enrollments')
      //   .select('id, beneficiary:quran_beneficiaries!inner(volunteer_id)')
      //   .eq('beneficiary.volunteer_id', user.id)
      //   .limit(1);

      // setIsCircleOrganizer(enrollmentData && enrollmentData.length > 0);
    };
    checkCircleOrganizer();
  }, [user?.id]);

  // Base volunteer nav items
  const baseVolunteerNavItems = [
    { title: t('nav.dashboard'), url: '/dashboard', icon: Home },
    { title: t('nav.logActivity'), url: '/activity', icon: Activity },
    { title: t('nav.profile'), url: '/profile', icon: User },
  ];

  // Add My Courses if user is an organizer or marketer
  let volunteerNavItems = isCourseAccess
    ? [...baseVolunteerNavItems, { title: isRTL ? 'كورساتي' : 'My Courses', url: '/my-courses', icon: GraduationCap }]
    : baseVolunteerNavItems;

  // Add My Quran Circles if user is a circle organizer
  if (isCircleOrganizer) {
    volunteerNavItems = [...volunteerNavItems, { title: isRTL ? 'حلقاتي' : 'My Circles', url: '/my-quran-circles', icon: BookOpen }];
  }

  const supervisorNavItems = [
    { title: isRTL ? 'داشبورد' : 'My Dashboard', url: '/supervisor', icon: Home },
    { title: isRTL ? 'داشبورد الفرع' : 'Branch Dashboard', url: '/supervisor/dashboard', icon: BarChart3 },
    { title: t('nav.userManagement'), url: '/admin/users', icon: Users },
    { title: t('nav.committees'), url: '/admin/committees', icon: Settings },
    { title: t('nav.badges'), url: '/supervisor/badges', icon: Trophy },
    { title: t('nav.reports'), url: '/admin/reports', icon: BarChart3 },
    { title: isRTL ? 'الكورسات' : 'Courses', url: '/courses', icon: Activity },
    { title: isRTL ? 'المدربين' : 'Trainers', url: '/trainers', icon: UserCheck },
    { title: t('nav.logActivity'), url: '/supervisor/activity', icon: ClipboardCheck },
    { title: t('nav.profile'), url: '/supervisor/profile', icon: User },
    { title: t('nav.leaderboard'), url: '/leaderboard', icon: Trophy },
  ];

  // Base leader nav items
  const baseLeaderNavItems = [
    { title: isRTL ? 'داشبورد' : 'My Dashboard', url: '/leader', icon: Home },
    { title: t('leader.dashboard'), url: '/leader/committee', icon: Building2 },
    { title: t('leader.members'), url: '/leader/members', icon: Users },
    { title: t('nav.badges'), url: '/leader/badges', icon: Trophy },
    { title: t('nav.logActivity'), url: '/leader/activity', icon: ClipboardCheck },
    { title: t('nav.profile'), url: '/leader/profile', icon: User },
    { title: isRTL ? 'الكورسات' : 'Courses', url: '/courses', icon: Activity },
    { title: isRTL ? 'المدربين' : 'Trainers', url: '/trainers', icon: UserCheck },
  ];

  // Add My Courses only if user is an organizer
  let leaderNavItems = isCourseAccess
    ? [...baseLeaderNavItems, { title: isRTL ? 'كورساتي' : 'My Courses', url: '/my-courses', icon: GraduationCap }]
    : baseLeaderNavItems;

  // Add My Quran Circles if user is a circle organizer
  if (isCircleOrganizer) {
    leaderNavItems = [...leaderNavItems, { title: isRTL ? 'حلقاتي' : 'My Circles', url: '/my-quran-circles', icon: BookOpen }];
  }

  const adminNavItems = [
    { title: t('nav.dashboard'), url: '/admin', icon: Home },
    { title: t('nav.userManagement'), url: '/admin/users', icon: Users },
    { title: t('nav.committees'), url: '/admin/committees', icon: Settings },
    { title: t('nav.activities'), url: '/admin/activities', icon: Activity },
    { title: t('nav.badges'), url: '/admin/badges', icon: Trophy },
    { title: t('nav.reports'), url: '/admin/reports', icon: BarChart3 },
    { title: t('nav.caravans'), url: '/caravans', icon: Bus },
    { title: t('nav.courses'), url: '/courses', icon: Activity },
    { title: isRTL ? 'المدربين' : 'Trainers', url: '/trainers', icon: UserCheck },
    { title: t('nav.events'), url: '/events', icon: Calendar },
    { title: isRTL ? 'إدارة القرآن' : 'Quran Management', url: '/admin/quran', icon: BookOpen },
    { title: isRTL ? 'حلقات القرآن' : 'Quran Circles', url: '/admin/quran-circles', icon: Users },
    { title: isRTL ? 'إدارة المحفظين' : 'Quran Teachers', url: '/admin/quran-teachers', icon: Users },
    { title: isRTL ? 'إدارة الغرامات' : 'Fines Management', url: '/admin/fines', icon: FileCheck },
  ];

  const hrNavItems = [
    { title: t('nav.dashboard'), url: '/dashboard', icon: Home },
    { title: isRTL ? 'إدارة المشاركات' : 'Submission Management', url: '/hr/submissions', icon: FileCheck },
    { title: t('nav.userManagement'), url: '/admin/users', icon: Users },
    { title: t('nav.reports'), url: '/admin/reports', icon: BarChart3 },
    { title: t('nav.logActivity'), url: '/activity', icon: ClipboardCheck },
    { title: t('nav.profile'), url: '/profile', icon: User },
  ];

  const getNavItems = () => {
    switch (primaryRole) {
      case 'admin':
        return adminNavItems;
      case 'supervisor':
        return supervisorNavItems;
      case 'committee_leader':
        return leaderNavItems;
      case 'hr':
        return hrNavItems;
      case 'head_hr':
        return [
          { title: t('nav.dashboard'), url: '/dashboard', icon: Home },
          { title: isRTL ? 'إدارة المشاركات' : 'Submission Management', url: '/hr/submissions', icon: FileCheck },
          { title: isRTL ? 'المدربين' : 'Trainers', url: '/trainers', icon: UserCheck },
          { title: t('nav.userManagement'), url: '/admin/users', icon: Users },
          { title: t('nav.reports'), url: '/admin/reports', icon: BarChart3 },
          { title: t('nav.logActivity'), url: '/activity', icon: ClipboardCheck },
          { title: t('nav.profile'), url: '/profile', icon: User },
        ];
      case 'head_caravans':
        return [
          { title: isRTL ? 'داشبورد' : 'My Dashboard', url: '/leader', icon: Home },
          { title: t('nav.caravans'), url: '/caravans', icon: Bus },
          { title: isRTL ? 'المدربين' : 'Trainers', url: '/trainers', icon: UserCheck },
          { title: t('nav.logActivity'), url: '/leader/activity', icon: ClipboardCheck },
          { title: t('nav.profile'), url: '/leader/profile', icon: User },
        ];
      case 'head_events':
        return [
          { title: isRTL ? 'داشبورد' : 'My Dashboard', url: '/leader', icon: Home },
          { title: t('nav.events'), url: '/events', icon: Calendar },
          { title: isRTL ? 'المدربين' : 'Trainers', url: '/trainers', icon: UserCheck },
          { title: t('nav.reports'), url: '/admin/reports', icon: BarChart3 },
          { title: t('nav.logActivity'), url: '/leader/activity', icon: ClipboardCheck },
          { title: t('nav.profile'), url: '/leader/profile', icon: User },
        ];
      case 'head_production':
      case 'head_fourth_year':
        return [
          { title: isRTL ? 'داشبورد' : 'My Dashboard', url: '/leader', icon: Home },
          { title: t('leader.dashboard'), url: '/leader/committee', icon: Building2 },
          { title: t('leader.members'), url: '/leader/members', icon: Users },
          { title: isRTL ? 'المدربين' : 'Trainers', url: '/trainers', icon: UserCheck },
          { title: t('nav.reports'), url: '/admin/reports', icon: BarChart3 },
          { title: t('nav.logActivity'), url: '/leader/activity', icon: ClipboardCheck },
          { title: t('nav.profile'), url: '/leader/profile', icon: User },
        ];
      case 'head_ethics':
        return [
          { title: isRTL ? 'داشبورد' : 'My Dashboard', url: '/dashboard', icon: Home },
          { title: t('ethics.competition'), url: '/ethics/competition', icon: Award },
          { title: t('ethics.calls'), url: '/ethics/calls', icon: PhoneCall },
          { title: t('nav.logActivity'), url: '/activity', icon: ClipboardCheck },
          { title: t('nav.profile'), url: '/profile', icon: User },
        ];
      case 'head_quran':
        return [
          { title: isRTL ? 'داشبورد' : 'My Dashboard', url: '/dashboard', icon: Home },
          { title: isRTL ? 'مستفيدين القرآن' : 'Quran Beneficiaries', url: '/admin/quran', icon: BookOpen },
          { title: isRTL ? 'حلقات القرآن' : 'Quran Circles', url: '/admin/quran-circles', icon: Users },
          { title: t('nav.logActivity'), url: '/activity', icon: ClipboardCheck },
          { title: t('nav.profile'), url: '/profile', icon: User },
        ];
      case 'head_ashbal':
        return [
          { title: isRTL ? 'داشبورد' : 'My Dashboard', url: '/dashboard', icon: Home },
          { title: isRTL ? 'إدارة الأشبال' : 'Ashbal Management', url: '/ashbal/management', icon: Users },
          { title: t('nav.logActivity'), url: '/activity', icon: ClipboardCheck },
          { title: t('nav.profile'), url: '/profile', icon: User },
        ];
      default:
        return volunteerNavItems;
    }
  };

  let navItems = getNavItems();

  // Ensure organizers always see their management pages regardless of role
  if (isCourseAccess && !navItems.some(i => i.url === '/my-courses')) {
    navItems = [...navItems, { title: isRTL ? 'كورساتي' : 'My Courses', url: '/my-courses', icon: GraduationCap }];
  }

  if (isCircleOrganizer && !navItems.some(i => i.url === '/my-quran-circles')) {
    navItems = [...navItems, { title: isRTL ? 'حلقاتي' : 'My Circles', url: '/my-quran-circles', icon: BookOpen }];
  }
  const displayName = profile?.full_name || user?.email || 'User';
  const userInitials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <Sidebar collapsible="icon" side={isRTL ? 'right' : 'left'}>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="RTC Logo"
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground">RTC Mohandseen</span>
              <span className="text-xs text-muted-foreground">{t('app.tagline')}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.navigation')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Language Toggle & Theme Toggle */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={toggleLanguage}
                  tooltip={t('app.language')}
                >
                  <Languages className="h-4 w-4" />
                  <span>{language === 'en' ? 'العربية' : 'English'}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton tooltip={t('theme.toggle')}>
                      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                      <span>{t('theme.toggle')}</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                      <Sun className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
                      {t('theme.light')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                      <Moon className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
                      {t('theme.dark')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")}>
                      <Laptop className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
                      {t('theme.system')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2 px-2",
                collapsed && "justify-center px-0"
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex flex-col items-start text-left flex-1 min-w-0">
                    <span className="text-sm font-medium truncate w-full">{displayName}</span>
                    <span className="text-xs text-muted-foreground capitalize">{primaryRole}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} side="top" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              {t('common.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
