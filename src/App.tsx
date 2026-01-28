import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AppLayout } from "./components/layout/AppLayout";
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";

// Lazy load pages
const Auth = lazy(() => import("./pages/Auth"));
const VolunteerDashboard = lazy(() => import("./pages/volunteer/Dashboard"));
const LogActivity = lazy(() => import("./pages/volunteer/LogActivity"));
const Profile = lazy(() => import("./pages/volunteer/Profile"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const CommitteeManagement = lazy(() => import("./pages/admin/CommitteeManagement"));
const ActivityManagement = lazy(() => import("./pages/admin/ActivityManagement"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const BadgeManagement = lazy(() => import("./pages/admin/BadgeManagement"));
const SupervisorDashboard = lazy(() => import("./pages/supervisor/Dashboard"));
const SupervisorUserManagement = lazy(() => import("./pages/supervisor/UserManagement"));
const SupervisorActivityManagement = lazy(() => import("./pages/supervisor/ActivityManagement"));
const SupervisorCommitteeManagement = lazy(() => import("./pages/supervisor/CommitteeManagement"));
const SupervisorBadgeManagement = lazy(() => import("./pages/supervisor/BadgeManagement"));
const SupervisorReports = lazy(() => import("./pages/supervisor/Reports"));
const CommitteeLeaderDashboard = lazy(() => import("./pages/leader/Dashboard"));
const Members = lazy(() => import("./pages/leader/Members"));
const Caravans = lazy(() => import("./pages/caravans/Caravans"));
const CaravanManagement = lazy(() => import("./pages/caravans/CaravanManagement"));
const Events = lazy(() => import("./pages/events/Events"));
const EventManagement = lazy(() => import("./pages/events/EventManagement"));
const CourseManagement = lazy(() => import("./pages/courses/CourseManagement"));
const MyCourses = lazy(() => import("./pages/courses/MyCourses"));
const SubmissionManagement = lazy(() => import("./pages/hr/SubmissionManagement"));
const TrainerManagement = lazy(() => import("./pages/trainers/TrainerManagement"));
const IndividualCompetition = lazy(() => import("./pages/ethics/IndividualCompetition"));
const CallsManagement = lazy(() => import("./pages/ethics/CallsManagement"));
const QuranManagement = lazy(() => import("./pages/admin/QuranManagement"));
const BeneficiaryDetails = lazy(() => import("./pages/admin/BeneficiaryDetails"));
const QuranCircles = lazy(() => import("./pages/admin/QuranCircles"));
const QuranTeachers = lazy(() => import("./pages/admin/QuranTeachers"));
const AshbalManagement = lazy(() => import("./pages/ashbal/AshbalManagement"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes - data stays fresh, no refetch needed
      gcTime: 1000 * 60 * 10, // 10 minutes - keep in cache
      refetchOnWindowFocus: false, // Don't refetch when tab becomes active
      retry: 1, // Only retry once on failure
    },
  },
});

// Loading component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

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
  // Hook order fixed: Unconditional useAuth call
  const { isAuthenticated, isLoading, primaryRole, roles } = useAuth();

  const getDefaultRoute = () => {
    switch (primaryRole) {
      case 'admin':
        return '/admin';
      case 'supervisor':
        return '/supervisor';
      case 'committee_leader':
        return '/leader';
      case 'hr':
      case 'head_hr':
        return '/dashboard'; // Primarily they are volunteers who manage others
      case 'head_production':
      case 'head_fourth_year':
      case 'head_events':
      case 'head_caravans':
      case 'head_ashbal':
        return '/leader';
      case 'head_ethics':
        return '/dashboard';
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
      <Route
        path="/auth"
        element={
          isAuthenticated
            ? (roles.length === 0 ? (
              <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Navigate to={getDefaultRoute()} replace />
            ))
            : <Auth />
        }
      />
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/" element={<Navigate to={isAuthenticated ? getDefaultRoute() : "/auth"} replace />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {/* Volunteer Routes */}
        <Route path="/dashboard" element={<VolunteerDashboard />} />
        <Route path="/activity" element={<LogActivity />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />

        {/* Supervisor Routes */}
        <Route path="/supervisor" element={<VolunteerDashboard />} />
        <Route path="/supervisor/dashboard" element={<SupervisorDashboard />} />
        <Route path="/supervisor/users" element={<SupervisorUserManagement />} />
        <Route path="/supervisor/activities" element={<SupervisorActivityManagement />} />
        <Route path="/supervisor/committees" element={<SupervisorCommitteeManagement />} />
        <Route path="/supervisor/badges" element={<SupervisorBadgeManagement />} />
        <Route path="/supervisor/reports" element={<Reports />} />
        <Route path="/supervisor/activity" element={<LogActivity />} />
        <Route path="/supervisor/profile" element={<Profile />} />

        {/* Committee Leader Routes */}
        <Route path="/leader" element={<VolunteerDashboard />} />
        <Route path="/leader/committee" element={<CommitteeLeaderDashboard />} />
        <Route path="/leader/members" element={<Members />} />
        <Route path="/leader/members/:id" element={<Profile />} />
        <Route path="/leader/activity" element={<LogActivity />} />
        <Route path="/leader/profile" element={<Profile />} />

        {/* Caravans Routes */}
        <Route path="/caravans" element={<Caravans />}>
          <Route index element={<CaravanManagement />} />
        </Route>

        {/* Events Routes */}
        <Route path="/events" element={<Events />}>
          <Route index element={<EventManagement />} />
        </Route>

        {/* Course Routes */}
        <Route path="/courses" element={<CourseManagement />} />
        <Route path="/my-courses" element={<MyCourses />} />
        <Route path="/trainers" element={<TrainerManagement />} />

        {/* HR Routes */}
        <Route path="/hr/submissions" element={<SubmissionManagement />} />

        {/* Ethics Routes */}
        <Route path="/ethics/competition" element={<IndividualCompetition />} />
        <Route path="/ethics/calls" element={<CallsManagement />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/committees" element={<CommitteeManagement />} />
        <Route path="/admin/activities" element={<ActivityManagement />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/badges" element={<BadgeManagement />} />
        <Route path="/admin/quran" element={<QuranManagement />} />
        <Route path="/admin/quran/:id" element={<BeneficiaryDetails />} />
        <Route path="/admin/quran-circles" element={<QuranCircles />} />
        <Route path="/admin/quran-teachers" element={<QuranTeachers />} />

        {/* Ashbal Routes */}
        <Route path="/ashbal/management" element={<AshbalManagement />} />
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
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ScrollToTop />
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <AppRoutes />
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
