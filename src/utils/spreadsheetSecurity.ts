export type SpreadsheetValue = string | number | boolean | null | undefined;
export type SpreadsheetRow = Record<string, SpreadsheetValue>;

const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@]/;

const normalizeSpreadsheetText = (value: string) => Array.from(value)
  .map((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  })
  .join('');

export const sanitizeSpreadsheetValue = (value: SpreadsheetValue): SpreadsheetValue => {
  if (typeof value !== 'string') return value;

  const normalizedValue = normalizeSpreadsheetText(value);
  return SPREADSHEET_FORMULA_PREFIX.test(normalizedValue.trimStart()) ? `'${normalizedValue}` : normalizedValue;
};

export const sanitizeSpreadsheetRows = (rows: SpreadsheetRow[]) => rows.map(row => Object.fromEntries(
  Object.entries(row).map(([key, value]) => [key, sanitizeSpreadsheetValue(value)]),
));
