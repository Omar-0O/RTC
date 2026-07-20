import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { BranchProvider } from "./contexts/BranchContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./components/theme-provider";
import { AppLayout } from "./components/layout/AppLayout";
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";
import { NetworkStatus } from "./components/NetworkStatus";
import { useRealtimeSync } from "./hooks/useRealtimeSync";

// Lazy load pages
const Auth = lazy(() => import("./pages/Auth"));
const VolunteerDashboard = lazy(() => import("./pages/volunteer/Dashboard"));
const LogActivity = lazy(() => import("./pages/volunteer/LogActivity"));
const Profile = lazy(() => import("./pages/volunteer/Profile"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const ManageRooms = lazy(() => import("./pages/admin/rooms/ManageRooms"));
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
const LeaderBadgeAward = lazy(() => import("./pages/leader/BadgeAward"));
const Caravans = lazy(() => import("./pages/caravans/Caravans"));
const CaravanManagement = lazy(() => import("./pages/caravans/CaravanManagement"));
const Events = lazy(() => import("./pages/events/Events"));
const EventManagement = lazy(() => import("./pages/events/EventManagement"));
const MyEvents = lazy(() => import("./pages/events/MyEvents"));
const CourseManagement = lazy(() => import("./pages/courses/CourseManagement"));
const MyCourses = lazy(() => import("./pages/courses/MyCourses"));
const SubmissionManagement = lazy(() => import("./pages/hr/SubmissionManagement"));
const HRDashboard = lazy(() => import("./pages/hr/Dashboard"));
const Birthdays = lazy(() => import("./pages/admin/Birthdays"));
const TrainerManagement = lazy(() => import("./pages/trainers/TrainerManagement"));
const IndividualCompetition = lazy(() => import("./pages/ethics/IndividualCompetition"));
const CallsManagement = lazy(() => import("./pages/ethics/CallsManagement"));
const QuranManagement = lazy(() => import("./pages/admin/QuranManagement"));
const BeneficiaryDetails = lazy(() => import("./pages/admin/BeneficiaryDetails"));
const QuranDashboard = lazy(() => import("./pages/admin/QuranDashboard"));
const QuranCircles = lazy(() => import("./pages/admin/QuranCircles"));
const QuranTeachers = lazy(() => import("./pages/admin/QuranTeachers"));
const QuranMembers = lazy(() => import("./pages/admin/QuranMembers"));
const QuranParticipations = lazy(() => import("./pages/admin/QuranParticipations"));

const QuranBadges = lazy(() => import("./pages/admin/QuranBadges"));
const MyQuranCircles = lazy(() => import("./pages/quran/MyQuranCircles"));
const AshbalManagement = lazy(() => import("./pages/ashbal/AshbalManagement"));
const FineManagement = lazy(() => import("./pages/admin/FineManagement"));
const InterestedBeneficiaries = lazy(() => import("./pages/admin/InterestedBeneficiaries"));
const BranchManagement = lazy(() => import("./pages/admin/BranchManagement"));
const FollowUpManagement = lazy(() => import("./pages/admin/FollowUpManagement"));
const UnderFollowUp = lazy(() => import("./pages/supervisor/UnderFollowUp"));
const LogForVolunteer = lazy(() => import("./pages/supervisor/LogForVolunteer"));
const VolunteerPortal = lazy(() => import("./pages/VolunteerPortal"));
const Kiosk = lazy(() => import("./pages/Kiosk"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ExecutiveDashboard = lazy(() => import("./pages/executive/Dashboard"));
const AboutProject = lazy(() => import("./pages/AboutProject"));

// Production-hardened QueryClient configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,       // 2 min — data stays fresh
      gcTime: 10 * 60 * 1000,          // 10 min — keep in GC cache
      refetchOnWindowFocus: false,      // Don't refetch on tab switch (causes jank)
      refetchOnReconnect: 'always',     // Always refetch when coming back online
      retry: (failureCount, error) => {
        // Never retry 4xx errors (auth, validation, not-found)
        if (error instanceof Error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('permission') || msg.includes('not found') || msg.includes('duplicate')) {
            return false;
          }
        }
        // Retry network errors up to 2 times with exponential backoff
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: false,  // Never auto-retry mutations (could cause duplicates)
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

const KIOSK_ROLES = new Set([
  'admin',
  'branch_admin',
  'executive',
  'supervisor',
  'committee_leader',
  'hr',
  'head_hr',
]);

function KioskRoute() {
  const { isLoading, isAuthenticated, roles } = useAuth();
  const savedKioskBranchId = localStorage.getItem('rtc_kiosk_branch_id');

  if (isLoading) return <PageLoader />;
  if (savedKioskBranchId) return <Kiosk />;

  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!roles.some((role) => KIOSK_ROLES.has(role))) return <Navigate to="/dashboard" replace />;

  return <Kiosk />;
}

function AppRoutes() {
  // Hook order fixed: Unconditional useAuth call
  const { isAuthenticated, isLoading, primaryRole, roles } = useAuth();

  // Subscribe to realtime changes on critical tables when authenticated
  useRealtimeSync({ enabled: isAuthenticated && !isLoading });

  const getDefaultRoute = () => {
    switch (primaryRole) {
      case 'admin':
        return '/admin';
      case 'executive':
        return '/executive';
      case 'branch_admin':
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
      case 'head_marketing':
        return '/leader';
      case 'head_quran':
        return '/admin/quran-dashboard';
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
            ? <Navigate to={getDefaultRoute()} replace />
            : <Auth />
        }
      />
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/" element={<Navigate to={isAuthenticated ? getDefaultRoute() : "/auth"} replace />} />
      <Route path="/test-activity" element={<LogActivity />} />

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
        <Route path="/supervisor/badges" element={<LeaderBadgeAward />} />
        <Route path="/supervisor/reports" element={<Reports />} />
        <Route path="/supervisor/activity" element={<LogActivity />} />
        <Route path="/supervisor/profile" element={<Profile />} />
        <Route path="/supervisor/under-follow-up" element={<UnderFollowUp />} />
        <Route path="/supervisor/log-for/:volunteerId" element={<LogForVolunteer />} />

        {/* Committee Leader Routes */}
        <Route path="/leader" element={<VolunteerDashboard />} />
        <Route path="/leader/committee" element={<CommitteeLeaderDashboard />} />
        <Route path="/leader/members" element={<Members />} />
        <Route path="/leader/members/:id" element={<Profile />} />
        <Route path="/leader/badges" element={<LeaderBadgeAward />} />
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
        <Route path="/my-events" element={<MyEvents />} />
        <Route path="/trainers" element={<TrainerManagement />} />

        {/* HR Routes */}
        <Route path="/hr/dashboard" element={<HRDashboard />} />
        <Route path="/hr/submissions" element={<SubmissionManagement />} />
        <Route path="/birthdays" element={<Birthdays />} />

        {/* Ethics Routes */}
        <Route path="/ethics/competition" element={<IndividualCompetition />} />
        <Route path="/ethics/calls" element={<CallsManagement />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/rooms" element={<ManageRooms />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/committees" element={<CommitteeManagement />} />
        <Route path="/admin/activities" element={<ActivityManagement />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/badges" element={<BadgeManagement />} />
        <Route path="/admin/submissions" element={<SubmissionManagement />} />

        <Route path="/admin/quran-dashboard" element={<QuranDashboard />} />
        <Route path="/admin/quran/participations" element={<QuranParticipations />} />
        <Route path="/admin/quran/members" element={<QuranMembers />} />
        <Route path="/admin/quran/badges" element={<QuranBadges />} />

        <Route path="/admin/quran-circles" element={<QuranCircles />} />
        <Route path="/marketing/quran-circles" element={<QuranCircles />} />
        <Route path="/admin/quran-teachers" element={<QuranTeachers />} />
        <Route path="/my-quran-circles" element={<MyQuranCircles />} />
        <Route path="/admin/fines" element={<FineManagement />} />
        <Route path="/admin/interested" element={<InterestedBeneficiaries />} />
        <Route path="/admin/branches" element={<BranchManagement />} />
        <Route path="/admin/followup" element={<FollowUpManagement />} />

        {/* Executive Routes */}
        <Route path="/executive" element={<ExecutiveDashboard />} />
        <Route path="/executive/reports" element={<Reports />} />

        {/* Ashbal Routes */}
        <Route path="/ashbal/management" element={<AshbalManagement />} />

        {/* About Project */}
        <Route path="/about" element={<AboutProject />} />
      </Route>

      {/* Public Volunteer Portal — no auth required */}
      <Route path="/volunteer-portal/:volunteerId" element={<VolunteerPortal />} />
      <Route path="/kiosk" element={<KioskRoute />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <BranchProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <ScrollToTop />
                <ErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <AppRoutes />
                  </Suspense>
                  <NetworkStatus />
                </ErrorBoundary>
              </BrowserRouter>
            </TooltipProvider>
          </BranchProvider>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
