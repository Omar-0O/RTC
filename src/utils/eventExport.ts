import { format } from 'date-fns';
import { getEventParticipants, type EventSummary } from '@/services/events.service';
import { addJsonRowsToSheet, appendAoaSheet, ensureXlsxFilename, exportXlsxSheets, loadXlsx } from '@/utils/xlsx';
import type { SpreadsheetRow } from '@/utils/spreadsheetSecurity';

type EventExportParams = {
  isRTL: boolean;
  formatTime: (time: string | null) => string;
};

const text = (isRTL: boolean, ar: string, en: string) => (isRTL ? ar : en);

export async function exportEventsListToXlsx({
  events,
  isRTL,
  formatTime,
}: EventExportParams & {
  events: EventSummary[];
}) {
  const rows: SpreadsheetRow[] = events.map((event) => ({
    [text(isRTL, 'الاسم', 'Event Name')]: event.name,
    [text(isRTL, 'النوع', 'Type')]: event.type,
    [text(isRTL, 'التاريخ', 'Date')]: event.date,
    [text(isRTL, 'الوقت', 'Time')]: formatTime(event.time),
    [text(isRTL, 'المكان', 'Location')]: event.location,
    [text(isRTL, 'عدد المشاركين', 'Participants Count')]: event.participants_count,
    [text(isRTL, 'الوصف', 'Description')]: event.description || '',
  }));

  await exportXlsxSheets(
    [{ name: 'Events', rows }],
    `Events_List_${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
  );
}

export async function exportEventDetailsToXlsx({
  event,
  isRTL,
  formatTime,
}: EventExportParams & {
  event: EventSummary;
}) {
  const { utils, writeFile } = await loadXlsx();
  const workbook = utils.book_new();
  const eventInfo = [
    [text(isRTL, 'اسم الايفينت', 'Event Name'), event.name],
    [text(isRTL, 'التاريخ', 'Date'), event.date],
    [text(isRTL, 'الوقت', 'Time'), formatTime(event.time)],
    [text(isRTL, 'المكان', 'Location'), event.location],
    [text(isRTL, 'النوع', 'Type'), event.type],
    [],
    [text(isRTL, 'قائمة المشاركين', 'Participants List')],
  ];

  const worksheet = appendAoaSheet(utils, workbook, eventInfo, 'Event Details');
  const participantsRows: SpreadsheetRow[] = (await getEventParticipants(event.id)).map((participant) => ({
    [text(isRTL, 'الاسم', 'Name')]: participant.name,
    [text(isRTL, 'الهاتف', 'Phone')]: participant.phone ? `'${participant.phone}` : '',
    [text(isRTL, 'النوع', 'Type')]: participant.is_volunteer
      ? text(isRTL, 'متطوع', 'Volunteer')
      : text(isRTL, 'ضيف', 'Guest'),
    [text(isRTL, 'كود التطوع', 'Volunteer ID')]: participant.volunteer_id || '',
  }));

  addJsonRowsToSheet(utils, worksheet, participantsRows, { origin: 'A8' });
  writeFile(workbook, ensureXlsxFilename(`${event.name.replace(/[^a-z0-9]/gi, '_')}_Details`));
}
