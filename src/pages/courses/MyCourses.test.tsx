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
    start_date: '2026-01-10',
    end_date: '2026-02-10',
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
    start_date: '2026-01-01',
    end_date: '2026-01-20',
    committee_id: 'comm-1',
    course_lectures: [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
    ],
  },
];

describe('MyCourses responsive course cards', () => {
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

    // Verify room labels, schedule day badges, lecture counts, and remaining count render
    expect(screen.getAllByText('قاعة المحاضرات الكبرى أ').length).toBeGreaterThan(0);
    expect(screen.getByText('سبت')).toBeInTheDocument();
    expect(screen.getByText('إثنين')).toBeInTheDocument();
    expect(screen.getByText('أربعاء')).toBeInTheDocument();
    expect(screen.getByText('8 محاضرة')).toBeInTheDocument();
    expect(screen.getAllByText('التفاصيل والحضور').length).toBeGreaterThanOrEqual(2);
  });

  it('opens course details dialog when clicking the card Details & Attendance button', async () => {
    render(<MyCourses />);

    await waitFor(() => {
      expect(screen.getByText('Full-Stack Web Development Bootcamp')).toBeInTheDocument();
    });

    const detailsButtons = screen.getAllByRole('button', { name: /التفاصيل والحضور/i });
    fireEvent.click(detailsButtons[0]);

    await waitFor(() => {
      expect(courseDetailsService.getCourseDetails).toHaveBeenCalledWith('course-1');
    });
  });

  it('supports LTR English rendering and search filtering', async () => {
    mockUseLanguage.mockReturnValue({ language: 'en', isRTL: false });

    render(<MyCourses />);

    await waitFor(() => {
      expect(screen.getByText('Full-Stack Web Development Bootcamp')).toBeInTheDocument();
    });

    expect(screen.getByText('My Courses')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search by course, trainer, or room...');
    fireEvent.change(searchInput, { target: { value: 'Bootcamp' } });

    expect(screen.getByText('Full-Stack Web Development Bootcamp')).toBeInTheDocument();
    expect(
      screen.queryByText('كورس الإسعافات الأولية المتقدم والتعامل مع الطوارئ الميدانية'),
    ).not.toBeInTheDocument();
  });
});
