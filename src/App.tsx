import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AppLayout } from "./components/layout/AppLayout";
import Auth from "./pages/Auth";
import VolunteerDashboard from "./pages/volunteer/Dashboard";
import LogActivity from "./pages/volunteer/LogActivity";
import Profile from "./pages/volunteer/Profile";
import Leaderboard from "./pages/Leaderboard";
import AdminDashboard from "./pages/admin/Dashboard";
import UserManagement from "./pages/admin/UserManagement";
import CommitteeManagement from "./pages/admin/CommitteeManagement";
import ActivityManagement from "./pages/admin/ActivityManagement";
import Reports from "./pages/admin/Reports";
import BadgeManagement from "./pages/admin/BadgeManagement";
import SupervisorDashboard from "./pages/supervisor/Dashboard";
import SupervisorUserManagement from "./pages/supervisor/UserManagement";
import SupervisorActivityManagement from "./pages/supervisor/ActivityManagement";
import SupervisorCommitteeManagement from "./pages/supervisor/CommitteeManagement";
import SupervisorBadgeManagement from "./pages/supervisor/BadgeManagement";
import SupervisorReports from "./pages/supervisor/Reports";
import CommitteeLeaderDashboard from "./pages/leader/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading, primaryRole } = useAuth();

  const getDefaultRoute = () => {
    switch (primaryRole) {
      case 'admin':
        return '/admin';
      case 'supervisor':
        return '/supervisor';
      case 'committee_leader':
        return '/leader';
      default:
        return '/dashboard';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={isAuthenticated ? <Navigate to={getDefaultRoute()} replace /> : <Auth />} />
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/" element={<Navigate to={isAuthenticated ? getDefaultRoute() : "/auth"} replace />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {/* Volunteer Routes */}
        <Route path="/dashboard" element={<VolunteerDashboard />} />
        <Route path="/activity" element={<LogActivity />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />

        {/* Supervisor Routes */}
        <Route path="/supervisor" element={<SupervisorDashboard />} />
        <Route path="/supervisor/users" element={<SupervisorUserManagement />} />
        <Route path="/supervisor/activities" element={<SupervisorActivityManagement />} />
        <Route path="/supervisor/committees" element={<SupervisorCommitteeManagement />} />
        <Route path="/supervisor/badges" element={<SupervisorBadgeManagement />} />
        <Route path="/supervisor/reports" element={<SupervisorReports />} />
        <Route path="/supervisor/activity" element={<LogActivity />} />
        <Route path="/supervisor/profile" element={<Profile />} />

        {/* Committee Leader Routes */}
        <Route path="/leader" element={<CommitteeLeaderDashboard />} />
        <Route path="/leader/members" element={<CommitteeLeaderDashboard />} />
        <Route path="/leader/activity" element={<LogActivity />} />
        <Route path="/leader/profile" element={<Profile />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/committees" element={<CommitteeManagement />} />
        <Route path="/admin/activities" element={<ActivityManagement />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/badges" element={<BadgeManagement />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
