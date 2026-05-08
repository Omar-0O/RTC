/**
 * @file phoneUtils.test.ts
 * @description Unit tests for the centralized phone normalization utility.
 *
 * Run with: npx vitest run src/utils/phoneUtils.test.ts
 * (or: npx jest src/utils/phoneUtils.test.ts if jest is configured)
 *
 * These tests do NOT require a browser environment — pure Node/TS.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizePhoneE164,
  waPhoneLink,
  phonesAreEqual,
  findPhoneDuplicates,
  isPhoneValid,
  INVALID_PHONE,
} from './phoneUtils';

// ---------------------------------------------------------------------------
// normalizePhoneE164 — Egyptian number variants
// ---------------------------------------------------------------------------
describe('normalizePhoneE164 — Egyptian formats', () => {
  const EXPECTED = '+2010xxxxxxxx'.replace('xxxxxxxx', '12345678'); // +201012345678

  const egyptianVariants = [
    ['Local 01x format',        '01012345678'],
    ['Local 01x with spaces',   '010 1234 5678'],
    ['Local 01x with dashes',   '010-1234-5678'],
    ['Missing leading zero',    '1012345678'],
    ['Prefix 201x (no +)',       '201012345678'],
    ['Prefix +201x',            '+201012345678'],
    ['Prefix 00201x',           '00201012345678'],
    ['Prefix 0020 then 1x',     '002001012345678'],
    ['With dots',               '010.1234.5678'],
    ['With parens',             '(010) 12345678'],
  ];

  it.each(egyptianVariants)('%s → %s', (_label, input) => {
    expect(normalizePhoneE164(input)).toBe('+201012345678');
  });

  it('Vodafone 011x prefix', () => {
    expect(normalizePhoneE164('01112345678')).toBe('+201112345678');
  });

  it('Etisalat 011x prefix', () => {
    expect(normalizePhoneE164('01512345678')).toBe('+201512345678');
  });

  it('WE 012x prefix', () => {
    expect(normalizePhoneE164('01212345678')).toBe('+201212345678');
  });
});

// ---------------------------------------------------------------------------
// normalizePhoneE164 — Arabic / Eastern-Arabic numerals
// ---------------------------------------------------------------------------
describe('normalizePhoneE164 — Arabic / Persian numerals', () => {
  it('Eastern-Arabic numerals (٠١٠١٢٣٤٥٦٧٨)', () => {
    // ٠ = 0x0660, ١ = 0x0661, etc.
    const arabic = '\u0660\u0661\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668'; // 01012345678
    expect(normalizePhoneE164(arabic)).toBe('+201012345678');
  });

  it('Persian numerals (۰۱۰…)', () => {
    const persian = '\u06F0\u06F1\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8'; // 01012345678
    expect(normalizePhoneE164(persian)).toBe('+201012345678');
  });
});

// ---------------------------------------------------------------------------
// normalizePhoneE164 — international numbers
// ---------------------------------------------------------------------------
describe('normalizePhoneE164 — international numbers', () => {
  it('US number with country code', () => {
    expect(normalizePhoneE164('+1 650 555 0100')).toBe('+16505550100');
  });

  it('UK number', () => {
    expect(normalizePhoneE164('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('Saudi number', () => {
    expect(normalizePhoneE164('+966 50 123 4567')).toBe('+966501234567');
  });
});

// ---------------------------------------------------------------------------
// normalizePhoneE164 — malformed / empty inputs
// ---------------------------------------------------------------------------
describe('normalizePhoneE164 — malformed / empty inputs', () => {
  it('null returns empty string', () => {
    expect(normalizePhoneE164(null)).toBe(INVALID_PHONE);
  });

  it('undefined returns empty string', () => {
    expect(normalizePhoneE164(undefined)).toBe(INVALID_PHONE);
  });

  it('empty string returns empty string', () => {
    expect(normalizePhoneE164('')).toBe(INVALID_PHONE);
  });

  it('only spaces returns empty string', () => {
    expect(normalizePhoneE164('   ')).toBe(INVALID_PHONE);
  });

  it('random letters return empty string', () => {
    expect(normalizePhoneE164('hello world')).toBe(INVALID_PHONE);
  });

  it('too short (3 digits) returns empty string', () => {
    expect(normalizePhoneE164('123')).toBe(INVALID_PHONE);
  });

  it('all zeros does not crash', () => {
    // Not a valid phone — should not throw
    expect(() => normalizePhoneE164('00000000000')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// isPhoneValid
// ---------------------------------------------------------------------------
describe('isPhoneValid', () => {
  it('valid Egyptian number returns true', () => {
    expect(isPhoneValid('01012345678')).toBe(true);
  });

  it('null returns false', () => {
    expect(isPhoneValid(null)).toBe(false);
  });

  it('garbage returns false', () => {
    expect(isPhoneValid('notaphone')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// waPhoneLink
// ---------------------------------------------------------------------------
describe('waPhoneLink', () => {
  it('generates correct wa.me URL', () => {
    expect(waPhoneLink('01012345678')).toBe('https://wa.me/201012345678');
  });

  it('strips + from E.164', () => {
    expect(waPhoneLink('+2010 1234 5678')).toBe('https://wa.me/201012345678');
  });

  it('returns null for invalid number', () => {
    expect(waPhoneLink(null)).toBeNull();
    expect(waPhoneLink('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// phonesAreEqual — same-number-in-two-fields validation
// ---------------------------------------------------------------------------
describe('phonesAreEqual', () => {
  it('same number in different formats → true', () => {
    expect(phonesAreEqual('01012345678', '+2010 1234 5678')).toBe(true);
    expect(phonesAreEqual('201012345678', '00201012345678')).toBe(true);
    expect(phonesAreEqual('+2010 1234 5678', '010-1234-5678')).toBe(true);
  });

  it('different numbers → false', () => {
    expect(phonesAreEqual('01012345678', '01198765432')).toBe(false);
  });

  it('null vs number → false', () => {
    expect(phonesAreEqual(null, '01012345678')).toBe(false);
  });

  it('two nulls → false (not equal — both missing)', () => {
    expect(phonesAreEqual(null, null)).toBe(false);
  });

  it('same-field guard: phone_1 === phone_2 variants', () => {
    // This is the "prevent phone_1 == phone_2" check
    const phone1 = '010 1234 5678';
    const phone2 = '2010 1234 5678'; // same number, different format
    expect(phonesAreEqual(phone1, phone2)).toBe(true); // → reject in UI
  });
});

// ---------------------------------------------------------------------------
// findPhoneDuplicates — duplicate detection
// ---------------------------------------------------------------------------
describe('findPhoneDuplicates', () => {
  it('detects duplicates across different formats', () => {
    const phones = [
      '01012345678',       // idx 0
      '+2010 1234 5678',   // idx 1 — same as 0
      '01198765432',       // idx 2 — unique
      '00201012345678',    // idx 3 — same as 0
      null,                // idx 4 — ignored
      '',                  // idx 5 — ignored
    ];

    const dupes = findPhoneDuplicates(phones);
    expect(dupes.size).toBe(1);

    const key = '+201012345678';
    expect(dupes.has(key)).toBe(true);
    expect(dupes.get(key)).toEqual([0, 1, 3]);
  });

  it('returns empty map when no duplicates', () => {
    const phones = ['01012345678', '01112345678', '01212345678'];
    expect(findPhoneDuplicates(phones).size).toBe(0);
  });

  it('handles all-null input gracefully', () => {
    expect(findPhoneDuplicates([null, null, undefined]).size).toBe(0);
  });

  it('detects intra-record same-field duplicate', () => {
    // If someone passes phone_1 and phone_2 of the same record
    const phone1 = '010 1234 5678';
    const phone2 = '2010 1234 5678';
    const dupes = findPhoneDuplicates([phone1, phone2]);
    expect(dupes.size).toBe(1);
  });
});
