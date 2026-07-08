import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { appendJsonSheet, ensureXlsxFilename, loadXlsx } from '@/utils/xlsx';
import type { SpreadsheetRow } from '@/utils/spreadsheetSecurity';

type CourseOrganizerRow = Pick<Database['public']['Tables']['course_organizers']['Row'], 'name' | 'phone'>;
type CourseLectureRow = Pick<Database['public']['Tables']['course_lectures']['Row'], 'id' | 'lecture_number' | 'date' | 'status'>;
type CourseBeneficiaryRow = Pick<Database['public']['Tables']['course_beneficiaries']['Row'], 'name' | 'phone'>;
type CourseAttendanceRow = Pick<Database['public']['Tables']['course_attendance']['Row'], 'lecture_id' | 'student_phone' | 'status'>;

export type CourseExportCourse = {
  id: string;
  name: string;
  trainer_name: string;
  trainer_phone: string | null;
  room: string;
  schedule_days: string[];
  schedule_time: string;
  schedule_end_time: string | null;
  has_interview: boolean;
  interview_date: string | null;
  total_lectures: number;
  start_date: string;
  end_date: string | null;
  has_certificates?: boolean;
  certificate_status?: string | null;
};

type ExportCourseReportParams = {
  course: CourseExportCourse;
  isRTL: boolean;
  getRoomLabel: (room: string) => string;
  getDayLabel: (day: string) => string | undefined;
  getCertificateStatusLabel?: (course: CourseExportCourse) => string;
};

const text = (isRTL: boolean, ar: string, en: string) => (isRTL ? ar : en);

const getLectureStatusLabel = (status: CourseLectureRow['status'], isRTL: boolean) => {
  if (status === 'completed') return text(isRTL, 'تمت', 'Completed');
  if (status === 'cancelled') return text(isRTL, 'ملغية', 'Cancelled');
  return text(isRTL, 'مجدولة', 'Scheduled');
};

const getCourseInfoRows = ({
  course,
  isRTL,
  getRoomLabel,
  getDayLabel,
  completedLectures,
  cancelledLectures,
  beneficiariesCount,
  getCertificateStatusLabel,
}: ExportCourseReportParams & {
  completedLectures: number;
  cancelledLectures: number;
  beneficiariesCount: number;
}): SpreadsheetRow[] => {
  const row: SpreadsheetRow = {
    [text(isRTL, 'اسم الكورس', 'Course Name')]: course.name,
    [text(isRTL, 'اسم المدرب', 'Trainer Name')]: course.trainer_name,
    [text(isRTL, 'رقم المدرب', 'Trainer Phone')]: course.trainer_phone || '-',
    [text(isRTL, 'القاعة', 'Room')]: getRoomLabel(course.room),
    [text(isRTL, 'الأيام', 'Days')]: course.schedule_days.map(day => getDayLabel(day)).filter(Boolean).join(', '),
    [text(isRTL, 'وقت البداية', 'Start Time')]: course.schedule_time,
    [text(isRTL, 'وقت الانتهاء', 'End Time')]: course.schedule_end_time || '-',
    [text(isRTL, 'عدد المحاضرات', 'Total Lectures')]: course.total_lectures,
    [text(isRTL, 'المحاضرات المكتملة', 'Completed')]: completedLectures,
    [text(isRTL, 'المحاضرات الملغية', 'Cancelled')]: cancelledLectures,
    [text(isRTL, 'تاريخ البداية', 'Start Date')]: course.start_date,
    [text(isRTL, 'تاريخ النهاية', 'End Date')]: course.end_date || '-',
    [text(isRTL, 'يوجد انترفيو', 'Has Interview')]: course.has_interview ? text(isRTL, 'نعم', 'Yes') : text(isRTL, 'لا', 'No'),
    [text(isRTL, 'تاريخ الانترفيو', 'Interview Date')]: course.interview_date || '-',
    [text(isRTL, 'عدد المستفيدين', 'Beneficiaries Count')]: beneficiariesCount,
  };

  if (getCertificateStatusLabel) {
    row[text(isRTL, 'حالة الشهادات', 'Certificates Status')] = getCertificateStatusLabel(course);
  }

  return [row];
};

const getAttendanceByLecture = (attendanceRows: CourseAttendanceRow[]) => {
  const attendanceByLecture: Record<string, Record<string, string>> = {};

  attendanceRows.forEach(attendance => {
    if (!attendance.lecture_id) return;

    attendanceByLecture[attendance.lecture_id] ??= {};
    attendanceByLecture[attendance.lecture_id][attendance.student_phone] = attendance.status || '';
  });

  return attendanceByLecture;
};

const getAttendanceRows = (
  beneficiaries: CourseBeneficiaryRow[],
  lectures: CourseLectureRow[],
  attendanceByLecture: Record<string, Record<string, string>>,
  isRTL: boolean,
) => beneficiaries.map(beneficiary => {
  const row: SpreadsheetRow = {
    [text(isRTL, 'الاسم', 'Name')]: beneficiary.name,
    [text(isRTL, 'الرقم', 'Phone')]: beneficiary.phone,
  };
  let attended = 0;
  let missed = 0;

  lectures.forEach(lecture => {
    const status = attendanceByLecture[lecture.id]?.[beneficiary.phone];
    const columnName = isRTL ? `م${lecture.lecture_number}` : `L${lecture.lecture_number}`;

    if (status === 'present') {
      row[columnName] = text(isRTL, 'حضر', 'Present');
      attended += 1;
    } else if (lecture.status === 'completed') {
      row[columnName] = text(isRTL, 'غائب', 'Absent');
      missed += 1;
    } else {
      row[columnName] = '-';
    }
  });

  row[text(isRTL, 'عدد الحضور', 'Total Attended')] = attended;
  row[text(isRTL, 'عدد الغياب', 'Total Missed')] = missed;
  return row;
});

export const exportCourseReportToXlsx = async ({
  course,
  isRTL,
  getRoomLabel,
  getDayLabel,
  getCertificateStatusLabel,
}: ExportCourseReportParams) => {
  const [organizersResult, lecturesResult, beneficiariesResult] = await Promise.all([
    supabase.from('course_organizers').select('name, phone').eq('course_id', course.id),
    supabase.from('course_lectures').select('id, lecture_number, date, status').eq('course_id', course.id).order('lecture_number'),
    supabase.from('course_beneficiaries').select('name, phone').eq('course_id', course.id).order('name'),
  ]);

  if (organizersResult.error) throw organizersResult.error;
  if (lecturesResult.error) throw lecturesResult.error;
  if (beneficiariesResult.error) throw beneficiariesResult.error;

  const lectures = (lecturesResult.data || []) as CourseLectureRow[];
  const beneficiaries = (beneficiariesResult.data || []) as CourseBeneficiaryRow[];
  const lectureIds = lectures.map(lecture => lecture.id);
  const attendanceResult = lectureIds.length
    ? await supabase.from('course_attendance').select('lecture_id, student_phone, status').in('lecture_id', lectureIds)
    : { data: [], error: null };

  if (attendanceResult.error) throw attendanceResult.error;

  const completedLectures = lectures.filter(lecture => lecture.status === 'completed').length;
  const cancelledLectures = lectures.filter(lecture => lecture.status === 'cancelled').length;
  const organizers = (organizersResult.data || []) as CourseOrganizerRow[];
  const attendanceRows = (attendanceResult.data || []) as CourseAttendanceRow[];

  const courseInfoRows = getCourseInfoRows({
    course,
    isRTL,
    getRoomLabel,
    getDayLabel,
    completedLectures,
    cancelledLectures,
    beneficiariesCount: beneficiaries.length,
    getCertificateStatusLabel,
  });
  const organizersRows = organizers.map(organizer => ({
    [text(isRTL, 'اسم المنظم', 'Organizer Name')]: organizer.name,
    [text(isRTL, 'رقم التليفون', 'Phone')]: organizer.phone || '-',
  }));
  const lectureRows = lectures.map(lecture => ({
    [text(isRTL, 'رقم المحاضرة', 'Lecture #')]: lecture.lecture_number,
    [text(isRTL, 'التاريخ', 'Date')]: lecture.date,
    [text(isRTL, 'الحالة', 'Status')]: getLectureStatusLabel(lecture.status, isRTL),
  }));
  const attendanceSheetRows = getAttendanceRows(
    beneficiaries,
    lectures,
    getAttendanceByLecture(attendanceRows),
    isRTL,
  );

  const { utils, writeFile } = await loadXlsx();
  const workbook = utils.book_new();
  appendJsonSheet(utils, workbook, courseInfoRows, text(isRTL, 'معلومات الكورس', 'Course Info'));
  if (organizersRows.length > 0) {
    appendJsonSheet(utils, workbook, organizersRows, text(isRTL, 'المنظمين', 'Organizers'));
  }
  appendJsonSheet(utils, workbook, lectureRows, text(isRTL, 'المحاضرات', 'Lectures'));
  if (attendanceSheetRows.length > 0) {
    appendJsonSheet(utils, workbook, attendanceSheetRows, text(isRTL, 'شيت الحضور', 'Attendance Sheet'));
  }

  writeFile(workbook, ensureXlsxFilename(`${course.name}_Report.xlsx`));
};
