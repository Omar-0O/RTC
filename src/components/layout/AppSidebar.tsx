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
  Languages
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const { user, logout, switchRole } = useAuth();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const volunteerNavItems = [
    { title: t('nav.dashboard'), url: '/dashboard', icon: Home },
    { title: t('nav.logActivity'), url: '/activity', icon: Activity },
    { title: t('nav.leaderboard'), url: '/leaderboard', icon: Trophy },
    { title: t('nav.profile'), url: '/profile', icon: User },
  ];

  const supervisorNavItems = [
    { title: t('nav.dashboard'), url: '/supervisor', icon: Home },
    { title: t('nav.reviewSubmissions'), url: '/supervisor/submissions', icon: ClipboardCheck },
    { title: t('nav.leaderboard'), url: '/leaderboard', icon: Trophy },
  ];

  const adminNavItems = [
    { title: t('nav.dashboard'), url: '/admin', icon: Home },
    { title: t('nav.userManagement'), url: '/admin/users', icon: Users },
    { title: t('nav.committees'), url: '/admin/committees', icon: Settings },
    { title: t('nav.activities'), url: '/admin/activities', icon: Activity },
    { title: t('nav.reports'), url: '/admin/reports', icon: BarChart3 },
    { title: t('nav.leaderboard'), url: '/leaderboard', icon: Trophy },
  ];

  const getNavItems = () => {
    switch (user?.role) {
      case 'admin':
        return adminNavItems;
      case 'supervisor':
        return supervisorNavItems;
      default:
        return volunteerNavItems;
    }
  };

  const navItems = getNavItems();
  const userInitials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  return (
    <Sidebar collapsible="icon" side={isRTL ? 'right' : 'left'}>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            RTC
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground">{t('app.name')}</span>
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
                <SidebarMenuItem key={item.url}>
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
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex flex-col items-start text-left flex-1 min-w-0">
                    <span className="text-sm font-medium truncate w-full">{user?.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => switchRole('volunteer')}>
              {t('common.switchTo')} {t('common.volunteer')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => switchRole('supervisor')}>
              {t('common.switchTo')} {t('common.supervisor')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => switchRole('admin')}>
              {t('common.switchTo')} {t('common.admin')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              {t('common.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
