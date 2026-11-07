import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import MyCourses from './MyCourses';
import * as myCoursesService from '@/services/myCourses.service';
import * as courseDetailsService from '@/services/courseDetails.service';

const mockUseLanguage = vi.fn(() => ({
  language: 'ar',
  isRTL: true,
}));

const mockUser = { id: 'user-1' };
const mockProfile = { branch_id: 'branch-1' };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
  }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => mockUseLanguage(),
}));

vi.mock('@/services/myCourses.service', () => ({
  getBranchCourses: vi.fn(),
  getCourseRooms: vi.fn(),
  addCourseBeneficiary: vi.fn(),
  createCourseAd: vi.fn(),
  deleteCourseAd: vi.fn(),
  deleteCourseBeneficiary: vi.fn(),
  toggleCourseAttendance: vi.fn(),
  updateCourseAd: vi.fn(),
  updateCourseBeneficiary: vi.fn(),
  updateCourseLectureStatus: vi.fn(),
}));

vi.mock('@/services/courseDetails.service', () => ({
  getCourseDetails: vi.fn(),
}));

vi.mock('@/services/courseParticipation.service', () => ({
  createCourseTrainerParticipation: vi.fn(),
}));

const sampleCourses = [
  {
    id: 'course-1',
    name: 'كورس الإسعافات الأولية المتقدم والتعامل مع الطوارئ الميدانية',
    trainer_id: 'trainer-1',
    trainer_name: 'د. أحمد محمد عبد الرحمن',
    trainer_phone: '01012345678',
    room: 'room-1',
    schedule_days: ['saturday', 'monday', 'wednesday'],
    schedule_time: '14:30',
    schedule_end_time: '16:30',
    has_interview: false,
    interview_date: null,
    total_lectures: 8,
    start_date: '2026-05-10',
    end_date: '2026-05-30',
    committee_id: 'comm-1',
    course_lectures: [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
      { status: 'scheduled' },
    ],
  },
  {
    id: 'course-2',
    name: 'Full-Stack Web Development Bootcamp',
    trainer_id: 'trainer-2',
    trainer_name: 'Eng. Omar El-Sayed',
    trainer_phone: '01122334455',
    room: 'room-2',
    schedule_days: ['sunday', 'tuesday', 'thursday'],
    schedule_time: '18:00',
    schedule_end_time: '20:00',
    has_interview: false,
    interview_date: null,
    total_lectures: 4,
    start_date: '2026-05-01',
    end_date: '2026-05-20',
    committee_id: 'comm-1',
    course_lectures: [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
    ],
  },
  {
    id: 'course-3',
    name: 'تصميم واجهات المستخدم وتجربة المستخدم UI/UX',
    trainer_id: 'trainer-3',
    trainer_name: 'سارة إبراهيم',
    trainer_phone: '01234567890',
    room: 'room-1',
    schedule_days: ['monday', 'thursday'],
    schedule_time: '17:00',
    schedule_end_time: '19:00',
    has_interview: false,
    interview_date: null,
    total_lectures: 6,
    start_date: '2026-03-01',
    end_date: '2026-03-25',
    committee_id: 'comm-1',
    course_lectures: [],
  },
  // Courses 4 through 12 to test lazy loading (12 items total, batch size = 9)
  // Start dates in 2025 so under date-desc, course-1, course-2, course-3 (2026) appear at the top
  ...Array.from({ length: 9 }, (_, idx) => ({
    id: `course-${idx + 4}`,
    name: `كورس تدريبي إضافي رقم ${idx + 4}`,
    trainer_id: 'trainer-1',
    trainer_name: 'مدرب معتمد',
    trainer_phone: '01000000000',
    room: 'room-1',
    schedule_days: ['sunday'],
    schedule_time: '10:00',
    schedule_end_time: '12:00',
    has_interview: false,
    interview_date: null,
    total_lectures: 5,
    start_date: `2025-01-${String(30 - idx).padStart(2, '0')}`,
    end_date: '2025-02-15',
    committee_id: 'comm-1',
    course_lectures: [{ status: 'completed' }],
  })),
];

describe('MyCourses responsive course cards, month filter, sorting, and lazy loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUseLanguage.mockReturnValue({ language: 'ar', isRTL: true });

    vi.mocked(myCoursesService.getBranchCourses).mockResolvedValue(sampleCourses as never);
    vi.mocked(myCoursesService.getCourseRooms).mockResolvedValue([
      { id: 'room-1', name: 'Hall A', name_ar: 'قاعة المحاضرات الكبرى أ' },
      { id: 'room-2', name: 'Lab 2', name_ar: 'معمل الكمبيوتر ٢' },
    ]);
    vi.mocked(courseDetailsService.getCourseDetails).mockResolvedValue({
      ads: [],
      lectures: [],
      beneficiaries: [],
      attendanceByLecture: {},
    });
  });

  it('renders responsive course cards with mobile-safe constraints and schedule badges in RTL', async () => {
    const { container } = render(<MyCourses />);

    await waitFor(() => {
      expect(
        screen.getByText('كورس الإسعافات الأولية المتقدم والتعامل مع الطوارئ الميدانية'),
      ).toBeInTheDocument();
    });

    // Verify courses grid uses mobile-first grid-cols-1 with responsive breakpoints and min-w-0
    const grid = container.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.xl\\:grid-cols-3');
    expect(grid).not.toBeNull();
    expect(grid?.className).toContain('min-w-0');

    // Verify room labels, schedule day badges, lecture counts, and details button render
    expect(screen.getAllByText('قاعة المحاضرات الكبرى أ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('سبت').length).toBeGreaterThan(0);
    expect(screen.getAllByText('إثنين').length).toBeGreaterThan(0);
    expect(screen.getAllByText('أربعاء').length).toBeGreaterThan(0);
    expect(screen.getByText('8 محاضرة')).toBeInTheDocument();
    expect(screen.getAllByText('التفاصيل والحضور').length).toBeGreaterThanOrEqual(2);
  });

  it('opens course details dialog when clicking the card Details & Attendance button', async () => {
    render(<MyCourses />);

    await waitFor(() => {
      expect(screen.getByText('Full-Stack Web Development Bootcamp')).toBeInTheDocument();
    });

    const detailsButtons = screen.getAllByRole('button', { name: /التفاصيل والحضور/i });
    fireEvent.click(detailsButtons[1]); // Course 2

    await waitFor(() => {
      expect(courseDetailsService.getCourseDetails).toHaveBeenCalled();
    });
  });

  it('supports LTR English rendering and search filtering', async () => {
    mockUseLanguage.mockReturnValue({ language: 'en', isRTL: false });

    render(<MyCourses />);

    await waitFor(() => {
      expect(screen.getByText('Full-Stack Web Development Bootcamp')).toBeInTheDocument();
    });

    expect(screen.getByText('My Courses')).toBeInTheDocument();
    expect(screen.getAllByText('Sun').length).toBeGreaterThan(0);

    const searchInput = screen.getByPlaceholderText('Search by course, trainer, or room...');
    fireEvent.change(searchInput, { target: { value: 'Bootcamp' } });

    expect(screen.getByText('Full-Stack Web Development Bootcamp')).toBeInTheDocument();
    expect(
      screen.queryByText('كورس الإسعافات الأولية المتقدم والتعامل مع الطوارئ الميدانية'),
    ).not.toBeInTheDocument();
  });

  it('filters courses by month using MonthPicker and resets filter', async () => {
    render(<MyCourses />);

    await waitFor(() => {
      expect(screen.getByText('Full-Stack Web Development Bootcamp')).toBeInTheDocument();
    });

    // Open month picker popover
    const monthTrigger = screen.getByRole('button', { name: /تصفية بالشهر/i });
    expect(monthTrigger).toBeInTheDocument();
    fireEvent.click(monthTrigger);

    // Click on March month button inside MonthPicker
    const marchButtons = screen.getAllByRole('button').filter(btn => /مارس|Mar/i.test(btn.textContent || ''));
    expect(marchButtons.length).toBeGreaterThan(0);
    fireEvent.click(marchButtons[0]);

    await waitFor(() => {
      // Course 3 is in March 2026
      expect(screen.getByText('تصميم واجهات المستخدم وتجربة المستخدم UI/UX')).toBeInTheDocument();
      // Course 2 was in May 2026, should not be displayed
      expect(screen.queryByText('Full-Stack Web Development Bootcamp')).not.toBeInTheDocument();
    });

    // Reset filter
    const resetButton = screen.getByRole('button', { name: /إعادة ضبط/i });
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByText('Full-Stack Web Development Bootcamp')).toBeInTheDocument();
    });
  });

  it('lazily loads courses in batches of 9 and renders remaining on Load More click', async () => {
    render(<MyCourses />);

    await waitFor(() => {
      expect(screen.getByText('Full-Stack Web Development Bootcamp')).toBeInTheDocument();
    });

    // 12 courses exist in sampleCourses, but initial batch size is 9
    // Course 12 is at the end (2025-01-09) and should not be visible yet
    expect(screen.queryByText('كورس تدريبي إضافي رقم 12')).not.toBeInTheDocument();

    // Load more button should show remaining count (3 remaining)
    const loadMoreButton = screen.getByRole('button', { name: /عرض المزيد من الكورسات/i });
    expect(loadMoreButton).toBeInTheDocument();
    expect(loadMoreButton.textContent).toContain('3');

    // Click load more button
    fireEvent.click(loadMoreButton);

    await waitFor(() => {
      // Now Course 12 is loaded
      expect(screen.getByText('كورس تدريبي إضافي رقم 12')).toBeInTheDocument();
      // Load more button should now disappear since all 12 are loaded
      expect(screen.queryByRole('button', { name: /عرض المزيد من الكورسات/i })).not.toBeInTheDocument();
    });
  });

  it('preserves pinned courses at the top regardless of sorting', async () => {
    // Pin course-2
    localStorage.setItem('rtc_pinned_courses_user-1', JSON.stringify(['course-2']));

    render(<MyCourses />);

    await waitFor(() => {
      expect(screen.getByText('Full-Stack Web Development Bootcamp')).toBeInTheDocument();
    });

    // Pinned course badge should be present
    expect(screen.getByText('مثبت')).toBeInTheDocument();
    expect(screen.getByText(/1 كورس مثبت في المقدمة/i)).toBeInTheDocument();
  });
});
