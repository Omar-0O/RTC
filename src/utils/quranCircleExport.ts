import {
  getCircleAttendance,
  getCircleEnrollments,
  getCircleSessions,
  type ScheduleItem,
} from '@/services/circles.service';
import { exportXlsxSheets } from '@/utils/xlsx';
import type { SpreadsheetRow } from '@/utils/spreadsheetSecurity';

export type QuranCircleExportCircle = {
  id: string;
  teacher_name?: string;
  schedule: ScheduleItem[];
};

type ExportQuranCircleReportParams<TCircle extends QuranCircleExportCircle> = {
  circle: TCircle;
  isRTL: boolean;
  getCircleName: (circle: TCircle) => string;
  getScheduleDisplay: (schedule: ScheduleItem[]) => string;
  getScheduleTime: (schedule: ScheduleItem[]) => string;
  getSessionDayLabel: (sessionDate: string) => string;
  sortSessionsByDate?: boolean;
};

const text = (isRTL: boolean, ar: string, en: string) => (isRTL ? ar : en);

const getAttendanceBySession = (
  attendanceMap: Awaited<ReturnType<typeof getCircleAttendance>>,
) => {
  const attendanceBySession: Record<string, Record<string, string>> = {};

  Object.entries(attendanceMap).forEach(([sessionId, records]) => {
    attendanceBySession[sessionId] = {};
    records.forEach((record) => {
      attendanceBySession[sessionId][record.beneficiary_id] = record.attendance_type;
    });
  });

  return attendanceBySession;
};

export const exportQuranCircleReportToXlsx = async <TCircle extends QuranCircleExportCircle>({
  circle,
  isRTL,
  getCircleName,
  getScheduleDisplay,
  getScheduleTime,
  getSessionDayLabel,
  sortSessionsByDate = true,
}: ExportQuranCircleReportParams<TCircle>) => {
  const [sessionsResult, beneficiaries] = await Promise.all([
    getCircleSessions(circle.id),
    getCircleEnrollments(circle.id),
  ]);
  const sessions = sortSessionsByDate
    ? [...sessionsResult].sort((a, b) => a.session_date.localeCompare(b.session_date))
    : sessionsResult;
  const attendanceBySession = getAttendanceBySession(
    await getCircleAttendance(sessions.map(session => session.id)),
  );

  const circleInfoRows: SpreadsheetRow[] = [{
    [text(isRTL, 'اسم الحلقة', 'Circle Name')]: getCircleName(circle),
    [text(isRTL, 'المحفظ', 'Teacher')]: circle.teacher_name || '-',
    [text(isRTL, 'الأيام', 'Days')]: getScheduleDisplay(circle.schedule),
    [text(isRTL, 'الوقت', 'Time')]: getScheduleTime(circle.schedule) || '-',
    [text(isRTL, 'عدد المسجلين', 'Enrolled Count')]: beneficiaries.length,
    [text(isRTL, 'عدد الجلسات', 'Sessions Count')]: sessions.length,
  }];

  const sessionRows: SpreadsheetRow[] = sessions.map((session, index) => ({
    [text(isRTL, 'رقم الجلسة', 'Session #')]: index + 1,
    [text(isRTL, 'التاريخ', 'Date')]: session.session_date,
    [text(isRTL, 'اليوم', 'Day')]: getSessionDayLabel(session.session_date),
    [text(isRTL, 'عدد الحضور', 'Attendees')]: Object.keys(attendanceBySession[session.id] || {}).length,
    [text(isRTL, 'ملاحظات', 'Notes')]: session.notes || '-',
  }));

  const attendanceRows: SpreadsheetRow[] = beneficiaries.map(beneficiary => {
    const row: SpreadsheetRow = {
      [text(isRTL, 'الاسم', 'Name')]: beneficiary.name_ar,
      [text(isRTL, 'الاسم الانجليزي', 'English Name')]: beneficiary.name_en || '-',
    };
    let totalAttended = 0;
    let memorization = 0;
    let revision = 0;

    sessions.forEach((session, index) => {
      const columnName = isRTL ? `ج${index + 1}` : `S${index + 1}`;
      const attendanceType = attendanceBySession[session.id]?.[beneficiary.id];

      if (!attendanceType) {
        row[columnName] = '-';
        return;
      }

      totalAttended += 1;
      if (attendanceType === 'memorization') {
        row[columnName] = isRTL ? 'حفظ' : 'M';
        memorization += 1;
      } else {
        row[columnName] = isRTL ? 'مراجعة' : 'R';
        revision += 1;
      }
    });

    row[text(isRTL, 'إجمالي الحضور', 'Total')] = totalAttended;
    row[text(isRTL, 'حفظ', 'Memorization')] = memorization;
    row[text(isRTL, 'مراجعة', 'Revision')] = revision;
    row[text(isRTL, 'نسبة الحضور', 'Attendance %')] = sessions.length
      ? `${Math.round((totalAttended / sessions.length) * 100)}%`
      : '0%';

    return row;
  });

  await exportXlsxSheets([
    { name: text(isRTL, 'معلومات الحلقة', 'Circle Info'), rows: circleInfoRows },
    { name: text(isRTL, 'الجلسات', 'Sessions'), rows: sessionRows },
    ...(attendanceRows.length > 0
      ? [{ name: text(isRTL, 'شيت الحضور', 'Attendance'), rows: attendanceRows }]
      : []),
  ], `${getCircleName(circle)}_Report.xlsx`);
};
