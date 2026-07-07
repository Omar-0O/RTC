import type { WorkBook } from '@e965/xlsx';
import {
  sanitizeSpreadsheetRows,
  sanitizeSpreadsheetValue,
  type SpreadsheetRow,
  type SpreadsheetValue,
} from '@/utils/spreadsheetSecurity';

type XlsxModule = typeof import('@e965/xlsx');
type XlsxUtils = XlsxModule['utils'];

type XlsxSheet = {
  name: string;
  rows: SpreadsheetRow[];
};

const XLSX_EXTENSION = '.xlsx';
const EXCEL_MAX_SHEET_NAME_LENGTH = 31;
const EXCEL_INVALID_SHEET_NAME_CHARS = /[:\\/?*[\]]/g;

export const loadXlsx = () => import('@e965/xlsx');

export const safeSheetName = (sheetName: string) => {
  const cleanedName = sheetName.replace(EXCEL_INVALID_SHEET_NAME_CHARS, ' ').trim();
  return cleanedName.slice(0, EXCEL_MAX_SHEET_NAME_LENGTH) || 'Sheet';
};

export const ensureXlsxFilename = (filename: string) =>
  filename.endsWith(XLSX_EXTENSION) ? filename : `${filename}${XLSX_EXTENSION}`;

export const sanitizeAoaRows = (rows: SpreadsheetValue[][]) =>
  rows.map(row => row.map(sanitizeSpreadsheetValue));

export const appendJsonSheet = (
  utils: XlsxUtils,
  workbook: WorkBook,
  rows: SpreadsheetRow[],
  sheetName: string,
) => {
  const worksheet = utils.json_to_sheet(sanitizeSpreadsheetRows(rows));
  utils.book_append_sheet(workbook, worksheet, safeSheetName(sheetName));
};

export const exportXlsxSheets = async (sheets: XlsxSheet[], filename: string) => {
  const { utils, writeFile } = await loadXlsx();
  const workbook = utils.book_new();

  sheets.forEach(sheet => appendJsonSheet(utils, workbook, sheet.rows, sheet.name));
  writeFile(workbook, ensureXlsxFilename(filename));
};
