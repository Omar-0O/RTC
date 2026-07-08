import type { WorkBook } from '@e965/xlsx';
import {
  sanitizeSpreadsheetRows,
  sanitizeSpreadsheetValue,
  type SpreadsheetRow,
  type SpreadsheetValue,
} from '@/utils/spreadsheetSecurity';
import { safeDownloadFilename } from '@/utils/downloadFilename';

type XlsxModule = typeof import('@e965/xlsx');
type XlsxUtils = XlsxModule['utils'];
type XlsxWorksheet = ReturnType<XlsxUtils['aoa_to_sheet']>;

type XlsxSheet = {
  name: string;
  rows: SpreadsheetRow[];
};

let xlsxModulePromise: Promise<XlsxModule> | null = null;

const XLSX_EXTENSION = '.xlsx';
const EXCEL_MAX_SHEET_NAME_LENGTH = 31;
const EXCEL_INVALID_SHEET_NAME_CHARS = /[:\\/?*[\]]/g;

export const loadXlsx = () => {
  xlsxModulePromise ??= import('@e965/xlsx');
  return xlsxModulePromise;
};

export const safeSheetName = (sheetName: string) => {
  const cleanedName = sheetName.replace(EXCEL_INVALID_SHEET_NAME_CHARS, ' ').trim();
  return cleanedName.slice(0, EXCEL_MAX_SHEET_NAME_LENGTH) || 'Sheet';
};

export const safeXlsxFilename = (filename: string) => safeDownloadFilename(filename, XLSX_EXTENSION, 'workbook');

export const ensureXlsxFilename = safeXlsxFilename;

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

export const appendAoaSheet = (
  utils: XlsxUtils,
  workbook: WorkBook,
  rows: SpreadsheetValue[][],
  sheetName: string,
  configureWorksheet?: (worksheet: XlsxWorksheet) => void,
) => {
  const worksheet = utils.aoa_to_sheet(sanitizeAoaRows(rows));
  configureWorksheet?.(worksheet);
  utils.book_append_sheet(workbook, worksheet, safeSheetName(sheetName));
  return worksheet;
};

export const exportXlsxSheets = async (sheets: XlsxSheet[], filename: string) => {
  const { utils, writeFile } = await loadXlsx();
  const workbook = utils.book_new();

  sheets.forEach(sheet => appendJsonSheet(utils, workbook, sheet.rows, sheet.name));
  writeFile(workbook, safeXlsxFilename(filename));
};
