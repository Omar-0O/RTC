export type SpreadsheetValue = string | number | boolean | null | undefined;
export type SpreadsheetRow = Record<string, SpreadsheetValue>;

const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@]/;

export const sanitizeSpreadsheetValue = (value: SpreadsheetValue): SpreadsheetValue => {
  if (typeof value !== 'string') return value;

  const normalizedValue = value.replace(/[\r\n]+/g, ' ');
  return SPREADSHEET_FORMULA_PREFIX.test(normalizedValue) ? `'${normalizedValue}` : normalizedValue;
};

export const sanitizeSpreadsheetRows = (rows: SpreadsheetRow[]) => rows.map(row => Object.fromEntries(
  Object.entries(row).map(([key, value]) => [key, sanitizeSpreadsheetValue(value)]),
));
