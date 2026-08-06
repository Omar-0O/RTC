import { describe, it, expect } from 'vitest';
import {
  sanitizeSpreadsheetValue,
  sanitizeSpreadsheetRows,
} from './spreadsheetSecurity';

describe('spreadsheetSecurity', () => {
  it('passes safe strings and numbers unchanged', () => {
    expect(sanitizeSpreadsheetValue('Hello World')).toBe('Hello World');
    expect(sanitizeSpreadsheetValue(12345)).toBe(12345);
    expect(sanitizeSpreadsheetValue(true)).toBe(true);
    expect(sanitizeSpreadsheetValue(null)).toBeNull();
  });

  it('escapes formula prefixes (=, +, -, @)', () => {
    expect(sanitizeSpreadsheetValue('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(sanitizeSpreadsheetValue('+123456')).toBe("'+123456");
    expect(sanitizeSpreadsheetValue('-100')).toBe("'-100");
    expect(sanitizeSpreadsheetValue('@cmd')).toBe("'@cmd");
  });

  it('escapes leading formula characters after whitespace', () => {
    expect(sanitizeSpreadsheetValue('   =1+1')).toBe("'   =1+1");
  });

  it('strips non-printable control characters', () => {
    expect(sanitizeSpreadsheetValue("Line1\x00Line2\x07")).toBe("Line1 Line2 ");
  });

  it('sanitizes rows of records correctly', () => {
    const input = [
      { name: 'Alice', score: '=10+10' },
      { name: '=BOB', score: 20 },
    ];
    const output = sanitizeSpreadsheetRows(input);
    expect(output).toEqual([
      { name: 'Alice', score: "'=10+10" },
      { name: "'=BOB", score: 20 },
    ]);
  });
});
