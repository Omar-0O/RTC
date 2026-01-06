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
  GraduationCap
} from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const [isOrganizer, setIsOrganizer] = useState(false);

  // Check if user is a course organizer
  useEffect(() => {
    const checkOrganizer = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('course_organizers')
        .select('id')
        .eq('volunteer_id', user.id)
        .limit(1);
      setIsOrganizer(data && data.length > 0);
    };
    checkOrganizer();
  }, [user?.id]);

  // Base volunteer nav items
  const baseVolunteerNavItems = [
    { title: t('nav.dashboard'), url: '/dashboard', icon: Home },
    { title: t('nav.logActivity'), url: '/activity', icon: Activity },
    { title: t('nav.profile'), url: '/profile', icon: User },
  ];

  // Add My Courses only if user is an organizer
  const volunteerNavItems = isOrganizer
    ? [...baseVolunteerNavItems, { title: isRTL ? 'كورساتي' : 'My Courses', url: '/my-courses', icon: GraduationCap }]
    : baseVolunteerNavItems;

  const supervisorNavItems = [
    { title: isRTL ? 'لوحتي الشخصية' : 'My Dashboard', url: '/supervisor', icon: Home },
    { title: isRTL ? 'نظرة عامة' : 'Overview', url: '/supervisor/dashboard', icon: BarChart3 },
    { title: t('nav.userManagement'), url: '/supervisor/users', icon: Users },
    { title: t('nav.activities'), url: '/supervisor/activities', icon: Activity },
    { title: t('nav.committees'), url: '/supervisor/committees', icon: Settings },
    { title: t('nav.badges'), url: '/supervisor/badges', icon: Trophy },
    { title: t('nav.reports'), url: '/supervisor/reports', icon: BarChart3 },
    { title: isRTL ? 'الكورسات' : 'Courses', url: '/courses', icon: Activity },
    { title: t('nav.logActivity'), url: '/supervisor/activity', icon: ClipboardCheck },
    { title: t('nav.profile'), url: '/supervisor/profile', icon: User },
    { title: t('nav.leaderboard'), url: '/leaderboard', icon: Trophy },
  ];

  // Base leader nav items
  const baseLeaderNavItems = [
    { title: isRTL ? 'لوحتي الشخصية' : 'My Dashboard', url: '/leader', icon: Home },
    { title: t('leader.dashboard'), url: '/leader/committee', icon: Building2 },
    { title: t('leader.members'), url: '/leader/members', icon: Users },
    { title: t('nav.logActivity'), url: '/leader/activity', icon: ClipboardCheck },
    { title: t('nav.profile'), url: '/leader/profile', icon: User },
    { title: isRTL ? 'الكورسات' : 'Courses', url: '/courses', icon: Activity },
  ];

  // Add My Courses only if user is an organizer
  const leaderNavItems = isOrganizer
    ? [...baseLeaderNavItems, { title: isRTL ? 'كورساتي' : 'My Courses', url: '/my-courses', icon: GraduationCap }]
    : baseLeaderNavItems;

  const adminNavItems = [
    { title: t('nav.dashboard'), url: '/admin', icon: Home },
    { title: t('nav.userManagement'), url: '/admin/users', icon: Users },
    { title: t('nav.committees'), url: '/admin/committees', icon: Settings },
    { title: t('nav.activities'), url: '/admin/activities', icon: Activity },
    { title: t('nav.badges'), url: '/admin/badges', icon: Trophy },
    { title: t('nav.reports'), url: '/admin/reports', icon: BarChart3 },
    { title: t('nav.caravans'), url: '/caravans', icon: Bus },
    { title: t('nav.courses'), url: '/courses', icon: Activity },
    { title: t('nav.events'), url: '/events', icon: Calendar },
  ];

  const hrNavItems = [
    { title: t('nav.dashboard'), url: '/dashboard', icon: Home }, // Or a specific dashboard if needed
    { title: t('nav.userManagement'), url: '/admin/users', icon: Users }, // Reuse admin user management for now
    { title: t('nav.reports'), url: '/admin/reports', icon: BarChart3 }, // Reuse admin reports
    { title: t('nav.logActivity'), url: '/activity', icon: ClipboardCheck },
    { title: t('nav.profile'), url: '/profile', icon: User },
    // Head HR might have more, but for now they share this. 
    // If Head HR needs to be distinct, I can add logic. 
    // The user said "Head HR can promote", which is in user management.
    // "Have a sheet with all volunteers..." -> Reports.
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
      case 'head_hr':
        return hrNavItems;
      case 'head_fourth_year':
        return leaderNavItems;
      case 'head_caravans':
        return [
          { title: isRTL ? 'لوحتي الشخصية' : 'My Dashboard', url: '/leader', icon: Home },
          { title: t('nav.caravans'), url: '/caravans', icon: Bus },
          { title: t('nav.logActivity'), url: '/leader/activity', icon: ClipboardCheck },
          { title: t('nav.profile'), url: '/leader/profile', icon: User },
        ];
      case 'head_events':
        return [
          { title: isRTL ? 'لوحتي الشخصية' : 'My Dashboard', url: '/leader', icon: Home },
          { title: t('nav.events'), url: '/events', icon: Calendar },
          { title: t('nav.logActivity'), url: '/leader/activity', icon: ClipboardCheck },
          { title: t('nav.profile'), url: '/leader/profile', icon: User },
        ];
      case 'head_production':
        // Production head acts like a committee leader but without Caravan access from leaderNavItems if it was there
        // Actually leaderNavItems HAS caravans. So we need a version WITHOUT it.
        return leaderNavItems.filter(item => item.url !== '/caravans');
      default:
        return volunteerNavItems;
    }
  };

  const navItems = getNavItems();
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
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Language Toggle */}
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
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56">
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
