import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Reports from './Reports';
import { fetchAllReportActivitySubmissions } from '@/services/reportData.service';
import { supabase } from '@/integrations/supabase/client';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const translations: Record<string, string> = {
  'reports.title': 'التقارير والإحصائيات',
  'reports.subtitle': 'تحليل شامل لأداء المتطوعين واللجان',
  'reports.thisWeek': 'هذا الأسبوع',
  'reports.thisMonth': 'هذا الشهر',
  'reports.thirdYear': 'ثلث سنة',
  'reports.thisQuarter': 'هذا الربع',
  'reports.thisYear': 'هذه السنة',
  'reports.levelDistribution': 'توزيع المستويات',
  'reports.activityTrend': 'اتجاه الأنشطة',
  'reports.topActivities': 'أكثر الأنشطة مشاركة',
  'reports.exportData': 'تصدير البيانات',
  'reports.volunteerList': 'قائمة المتطوعين',
  'admin.totalVolunteers': 'إجمالي المتطوعين',
  'admin.totalActivities': 'الأنشطة المعتمدة',
  'level.under_follow_up': 'تحت المتابعة',
  'level.project_responsible': 'مشروع مسئول',
  'level.responsible': 'مسئول',
  'common.points': 'نقطة',
};

const mockUseLanguage = vi.fn(() => ({
  language: 'ar',
  isRTL: true,
  t: (key: string) => translations[key] || key,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => mockUseLanguage(),
}));

// Mock Recharts ResponsiveContainer so it renders children in JSDOM
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 400, height: 250 }}>
        {children}
      </div>
    ),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const nowIso = new Date().toISOString();

const sampleProfiles = [
  {
    id: 'vol-1',
    full_name: 'Ahmed Hassan',
    full_name_ar: 'أحمد حسن',
    email: 'ahmed@rtc.org',
    phone: '01011112222',
    total_points: 120,
    level: 'responsible',
    committee_id: 'comm-1',
    attended_mini_camp: true,
    attended_camp: true,
  },
  {
    id: 'vol-2',
    full_name: 'Sara Ali',
    full_name_ar: 'سارة علي',
    email: 'sara@rtc.org',
    phone: '01033334444',
    total_points: 60,
    level: 'project_responsible',
    committee_id: 'comm-1',
    attended_mini_camp: true,
    attended_camp: false,
  },
  {
    id: 'vol-3',
    full_name: 'Mona Ibrahim',
    full_name_ar: 'منى إبراهيم',
    email: 'mona@rtc.org',
    phone: '01055556666',
    total_points: 20,
    level: 'under_follow_up',
    committee_id: 'comm-1',
    attended_mini_camp: false,
    attended_camp: false,
  },
];

const sampleCommittees = [
  { id: 'comm-1', name: 'Media Committee', name_ar: 'لجنة الميديا' },
];

const sampleActivityTypes = [
  { id: 'act-1', name: 'Caravan Participation', name_ar: 'مشاركة قافلة ميدانية', points: 15 },
  { id: 'act-2', name: 'Content Creation', name_ar: 'تصميم محتوى إعلامي', points: 10 },
];

const sampleUserRoles = [
  { user_id: 'vol-1', role: 'supervisor' },
  { user_id: 'vol-2', role: 'volunteer' },
  { user_id: 'vol-3', role: 'volunteer' },
];

const sampleTrainers = [
  { id: 'tr-1', user_id: 'vol-1', name_en: 'Ahmed Hassan', name_ar: 'أحمد حسن', phone: '01011112222' },
];

const sampleSubmissions = [
  {
    id: 'sub-1',
    volunteer_id: 'vol-1',
    status: 'approved',
    points_awarded: 15,
    submitted_at: nowIso,
    activity_type_id: 'act-1',
    location: 'branch',
    wore_vest: true,
    committee_id: 'comm-1',
    description: 'Caravan work',
    proof_url: null,
    participants_count: 1,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    created_at: nowIso,
    participant_type: 'volunteer',
    guest_name: null,
    guest_phone: null,
    trainer_id: null,
  },
  {
    id: 'sub-2',
    volunteer_id: 'vol-2',
    status: 'approved',
    points_awarded: 10,
    submitted_at: nowIso,
    activity_type_id: 'act-2',
    location: 'home',
    wore_vest: false,
    committee_id: 'comm-1',
    description: 'Media task',
    proof_url: null,
    participants_count: 1,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    created_at: nowIso,
    participant_type: 'volunteer',
    guest_name: null,
    guest_phone: null,
    trainer_id: null,
  },
];

function setupSupabaseMocks(submissionsList = sampleSubmissions, totalCount = submissionsList.length) {
  const fromMock = vi.mocked(supabase.from);
  fromMock.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          neq: vi.fn().mockResolvedValue({ data: sampleProfiles, error: null }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
    }
    if (table === 'committees') {
      return {
        select: vi.fn().mockResolvedValue({ data: sampleCommittees, error: null }),
      } as unknown as ReturnType<typeof supabase.from>;
    }
    if (table === 'activity_types') {
      return {
        select: vi.fn().mockResolvedValue({ data: sampleActivityTypes, error: null }),
      } as unknown as ReturnType<typeof supabase.from>;
    }
    if (table === 'user_roles') {
      return {
        select: vi.fn().mockResolvedValue({ data: sampleUserRoles, error: null }),
      } as unknown as ReturnType<typeof supabase.from>;
    }
    if (table === 'trainers') {
      return {
        select: vi.fn().mockResolvedValue({ data: sampleTrainers, error: null }),
      } as unknown as ReturnType<typeof supabase.from>;
    }
    if (table === 'activity_submissions') {
      return {
        select: vi.fn().mockImplementation((_cols: string, opts?: { count?: string }) => ({
          range: vi.fn().mockImplementation((from: number, to: number) =>
            Promise.resolve({
              data: submissionsList.slice(from, to + 1),
              count: opts?.count ? totalCount : null,
              error: null,
            }),
          ),
        })),
      } as unknown as ReturnType<typeof supabase.from>;
    }
    return {
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as ReturnType<typeof supabase.from>;
  });
}

describe('fetchAllReportActivitySubmissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches first page and count in a single request when total rows <= pageSize', async () => {
    setupSupabaseMocks(sampleSubmissions, 2);

    const res = await fetchAllReportActivitySubmissions(1000);
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(2);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('fetches remaining pages concurrently via Promise.all when totalCount > pageSize', async () => {
    const manySubmissions = Array.from({ length: 5 }, (_, idx) => ({
      ...sampleSubmissions[0],
      id: `sub-${idx + 1}`,
    }));
    setupSupabaseMocks(manySubmissions, 5);

    const res = await fetchAllReportActivitySubmissions(2);
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(5);
    // 1 initial request (0..1) + 2 parallel requests (2..3 and 4..4) = 3 total calls
    expect(supabase.from).toHaveBeenCalledTimes(3);
  });
});

describe('Admin Reports Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMocks();
  });

  it('loads data in parallel and renders dynamic responsive stat, chart, and export cards', async () => {
    const { container } = render(<Reports />);

    await waitFor(() => {
      expect(screen.getByText('إجمالي المتطوعين')).toBeInTheDocument();
    });

    // Verify trainers was fetched alongside other tables on mount
    const calledTables = vi.mocked(supabase.from).mock.calls.map(c => c[0]);
    expect(calledTables).toContain('profiles');
    expect(calledTables).toContain('committees');
    expect(calledTables).toContain('activity_submissions');
    expect(calledTables).toContain('activity_types');
    expect(calledTables).toContain('user_roles');
    expect(calledTables).toContain('trainers');

    // Verify top activities are rendered
    expect(screen.getByText('مشاركة قافلة ميدانية')).toBeInTheDocument();
    expect(screen.getByText('تصميم محتوى إعلامي')).toBeInTheDocument();

    // Verify level distribution breakdown pills are rendered for mobile visibility
    expect(screen.getAllByText('تحت المتابعة').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('مشروع مسئول').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('مسئول').length).toBeGreaterThanOrEqual(2);

    // Verify cards have min-w-0 and overflow-hidden so they never break mobile layout
    const cards = container.querySelectorAll('.rounded-lg.border.bg-card');
    expect(cards.length).toBeGreaterThanOrEqual(11);
    cards.forEach(card => {
      expect(card.className).toContain('min-w-0');
      expect(card.className).toContain('overflow-hidden');
    });

    // Verify export buttons allow text wrapping on mobile (whitespace-normal)
    const exportVolunteerBtn = screen.getByRole('button', { name: /قائمة المتطوعين/i });
    expect(exportVolunteerBtn.className).toContain('whitespace-normal');
  });

  it('switches to Archive tab, hides main date range selector, and displays monthly archive cards', async () => {
    render(<Reports />);

    await waitFor(() => {
      expect(screen.getByText('إجمالي المتطوعين')).toBeInTheDocument();
    });

    const archiveTab = screen.getByRole('tab', { name: 'الأرشيف' });
    fireEvent.mouseDown(archiveTab, { button: 0, ctrlKey: false });
    fireEvent.click(archiveTab);

    await waitFor(() => {
      expect(screen.getByText('أرشيف التقارير')).toBeInTheDocument();
    });

    expect(screen.getByText('تنزيل تقارير الشهور السابقة')).toBeInTheDocument();
  });
});
