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
  ChevronDown
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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

const volunteerNavItems = [
  { title: 'Dashboard', url: '/dashboard', icon: Home },
  { title: 'Log Activity', url: '/activity', icon: Activity },
  { title: 'Leaderboard', url: '/leaderboard', icon: Trophy },
  { title: 'My Profile', url: '/profile', icon: User },
];

const supervisorNavItems = [
  { title: 'Dashboard', url: '/supervisor', icon: Home },
  { title: 'Review Submissions', url: '/supervisor/submissions', icon: ClipboardCheck },
  { title: 'Leaderboard', url: '/leaderboard', icon: Trophy },
];

const adminNavItems = [
  { title: 'Dashboard', url: '/admin', icon: Home },
  { title: 'User Management', url: '/admin/users', icon: Users },
  { title: 'Committees', url: '/admin/committees', icon: Settings },
  { title: 'Activities', url: '/admin/activities', icon: Activity },
  { title: 'Reports', url: '/admin/reports', icon: BarChart3 },
  { title: 'Leaderboard', url: '/leaderboard', icon: Trophy },
];

export function AppSidebar() {
  const { user, logout, switchRole } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            RTC
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground">RTC Pulse</span>
              <span className="text-xs text-muted-foreground">Volunteer Portal</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
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
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => switchRole('volunteer')}>
              Switch to Volunteer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => switchRole('supervisor')}>
              Switch to Supervisor
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => switchRole('admin')}>
              Switch to Admin
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
