import { Outlet, Link } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.webp';

export function AppLayout() {
  const { user } = useAuth();

  return (
    <SidebarProvider>
      <div className="flex min-h-[100dvh] w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 min-w-0">
          <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-6" />
            <Link to="/" className="flex items-center gap-2 transition-transform hover:scale-105 shrink-0">
              <img src={logo} alt="RTC Logo" className="h-10 w-10 rounded-md object-cover" />
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-semibold">
                {user?.role === 'admin' && 'Admin Dashboard'}
                {user?.role === 'supervisor' && 'Head of Branch Dashboard'}
                {user?.role === 'volunteer' && 'Volunteer Portal'}
              </h1>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
