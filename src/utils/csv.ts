import { sanitizeSpreadsheetRows, type SpreadsheetRow, type SpreadsheetValue } from '@/utils/spreadsheetSecurity';

const CSV_CELL_ESCAPE_PATTERN = /[",\r\n]/;

export const escapeCsvCell = (value: SpreadsheetValue) => {
  const textValue = String(value ?? '');

  if (!CSV_CELL_ESCAPE_PATTERN.test(textValue)) {
    return textValue;
  }

  return `"${textValue.replace(/"/g, '""')}"`;
};

export const buildCsv = (rows: SpreadsheetRow[]) => {
  if (rows.length === 0) return '';

  const safeRows = sanitizeSpreadsheetRows(rows);
  const headers = Object.keys(safeRows[0]);
  const csvRows = safeRows.map(row => headers.map(header => escapeCsvCell(row[header])).join(','));

  return ['\ufeff' + headers.join(','), ...csvRows].join('\n');
};

export const downloadCsvContent = (csvContent: string, filename: string) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);

  link.href = objectUrl;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(objectUrl);
};

export const downloadCsv = (rows: SpreadsheetRow[], filename: string) => {
  downloadCsvContent(buildCsv(rows), filename);
};
