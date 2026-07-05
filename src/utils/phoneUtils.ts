/**
 * @file phoneUtils.ts
 * @description Centralized phone number normalization utility.
 *
 * ALL phone comparisons, storage, duplicate checks, and WhatsApp links
 * in this codebase MUST go through these functions.
 *
 * Output format: E.164  (+<country_code><national_number>)
 * Default country: Egypt (EG)
 *
 * Supported input formats for Egyptian numbers:
 *   010xxxxxxxx        → +2010xxxxxxxx
 *   2010xxxxxxxx       → +2010xxxxxxxx
 *   +2010xxxxxxxx      → +2010xxxxxxxx
 *   002010xxxxxxxx     → +2010xxxxxxxx
 *   10xxxxxxxx         → +2010xxxxxxxx   (missing leading zero)
 *
 * Arabic/Eastern-Arabic/Persian numerals are converted to Western Arabic first.
 *
 * Non-Egyptian international numbers are also normalized to E.164 via libphonenumber-js.
 * If parsing fails the cleaned digit string is returned as-is (best-effort).
 */

import { parsePhoneNumber, isValidPhoneNumber, AsYouType, type CountryCode } from 'libphonenumber-js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert Arabic / Eastern-Arabic / Persian numerals to Western Arabic digits. */
function arabicToWesternDigits(str: string): string {
  return str
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660)) // Arabic-Indic
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0)); // Extended Arabic-Indic (Persian)
}

/**
 * Pre-process a raw phone string before passing to libphonenumber-js.
 *
 * IMPORTANT: Keep this logic in sync with the PostgreSQL trigger
 * `trg_normalize_followup_phones` in migration 20260508170000.
 *
 * 1. Convert Eastern numerals → Western
 * 2. Strip separators (spaces, dashes, dots, parens)
 * 3. Resolve Egyptian-specific international prefixes so the parser
 *    can recognise them as EG national numbers.
 */
function preProcess(raw: string): string {
  let s = arabicToWesternDigits(raw);
  // Normalise the + sign: remove leading zeroes that represent "00" international dialling
  // We keep the '+' if present, strip everything that is not a digit or '+'
  s = s.replace(/[^\d+]/g, '');

  // Collapse duplicate '+' signs and remove any '+' embedded mid-string.
  // e.g. "+20+201093355307" → "+201093355307"
  //      "+20+20..." → "+20..." (strip the repeated +20 prefix)
  if (s.startsWith('+20+')) {
    s = s.slice(3); // strip the first '+20', keep the '+201...' part
  } else if (s.indexOf('+', 1) !== -1) {
    // '+' appears somewhere other than the first character — remove all mid-string '+'
    s = (s.startsWith('+') ? '+' : '') + s.replace(/\+/g, '');
  }

  // Resolve Egyptian country code variants to a canonical +201... prefix
  // Priority: longest prefix first
  // NOTE: Do NOT strip digits for 14-char numbers here — let libphonenumber parse first.
  //       The 14-char fix is applied in the FALLBACK section of normalizePhoneE164.
  if (s.startsWith('00201')) {
    // 00201xxxxxxxxx → +201xxxxxxxxx
    s = '+' + s.slice(2);
  } else if (s.startsWith('0020')) {
    // 0020xxxxxxxxx (non-mobile EG landline) → +20xxxxxxxxx
    s = '+' + s.slice(2);
  } else if (
    (s.startsWith('+2010') || s.startsWith('+2011') || s.startsWith('+2012') || s.startsWith('+2015'))
    && s.length === 13
  ) {
    // Valid E.164 Egyptian mobile (exactly +20 + 10 digits = 13 chars) — keep as-is
  } else if (s.startsWith('2010') || s.startsWith('2011') || s.startsWith('2012') || s.startsWith('2015')) {
    // 201xxxxxxxxx (without +) → +201xxxxxxxxx
    s = '+' + s;
  } else if (s.startsWith('010') || s.startsWith('011') || s.startsWith('012') || s.startsWith('015')) {
    // Local Egyptian mobile 01X → +201X
    s = '+2' + s;
  } else if (s.startsWith('10') || s.startsWith('11') || s.startsWith('12') || s.startsWith('15')) {
    // Missing leading zero: 1Xxxxxxxx → +201X
    s = '+20' + s;
  }
  // All other formats (international +XX...) are passed through unchanged.

  return s;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Sentinel value returned when a number cannot be normalized at all. */
export const INVALID_PHONE = '';

/**
 * Normalize any phone number to E.164 format using libphonenumber-js.
 *
 * @param raw           Raw user input (any format, any language)
 * @param defaultCountry ISO 3166-1 alpha-2 country code used when the number
 *                       has no international prefix. Defaults to 'EG'.
 * @returns              E.164 string (e.g. "+2010xxxxxxxx") or '' if input is
 *                       empty / unparseable.
 *
 * @example
 *   normalizePhoneE164('010 1234 5678')     // '+20101234578'
 *   normalizePhoneE164('2010 1234 5678')    // '+20101234578'
 *   normalizePhoneE164('+2010 1234 5678')   // '+20101234578'
 *   normalizePhoneE164('002010 1234 5678')  // '+20101234578'
 *   normalizePhoneE164('+1 650-555-0100', 'US') // '+16505550100'
 */
export function normalizePhoneE164(
  raw: string | null | undefined,
  defaultCountry: CountryCode = 'EG'
): string {
  if (!raw) return INVALID_PHONE;

  const preprocessed = preProcess(raw.trim());
  if (!preprocessed) return INVALID_PHONE;

  try {
    // Attempt full parse with the default country as fallback
    const parsed = parsePhoneNumber(preprocessed, defaultCountry);
    if (parsed && parsed.isValid()) {
      return parsed.format('E.164');
    }
  } catch {
    // parsePhoneNumber can throw on completely invalid input
  }

  // Second attempt: if preprocessing added a '+' prefix, try without country hint
  if (preprocessed.startsWith('+')) {
    try {
      const parsed = parsePhoneNumber(preprocessed);
      if (parsed && parsed.isValid()) {
        return parsed.format('E.164');
      }
    } catch {
      // still failed — fall through
    }
  }

  // Last resort: the number couldn't be parsed by libphonenumber-js.
  // Produce a CONSISTENT canonical form so that different representations
  // of the same non-standard number compare equal.
  // e.g.  "0111111266756" and "+20111111266756" both → "111111266756"

  // Before fallback digit-stripping, try the 14-char Egyptian fix.
  // This handles numbers like +2011111266756 (14 chars = +20 + 11 digits)
  // which should be +201111266756 (strip the extra repeated digit after +20).
  if (
    preprocessed.length === 14 &&
    (preprocessed.startsWith('+2010') || preprocessed.startsWith('+2011') ||
     preprocessed.startsWith('+2012') || preprocessed.startsWith('+2015'))
  ) {
    const fixed = '+20' + preprocessed.slice(4);
    try {
      const parsed = parsePhoneNumber(fixed, defaultCountry);
      if (parsed && parsed.isValid()) {
        return parsed.format('E.164');
      }
    } catch { /* fall through */ }
  }

  let digits = preprocessed.replace(/[^\d]/g, '');

  // Strip Egyptian country code if present (handles "2010...", "2011...", "2012...", "2015...")
  if (
    (digits.startsWith('2010') || digits.startsWith('2011') ||
     digits.startsWith('2012') || digits.startsWith('2015')) &&
    digits.length > 10
  ) {
    digits = digits.slice(2); // strip '20', keep local number
  }

  // Strip local leading zero
  if (digits.startsWith('0') && digits.length > 7) {
    digits = digits.slice(1);
  }

  return digits.length >= 7 ? digits : INVALID_PHONE;
}

/**
 * Check if a phone string (after normalization) is considered valid.
 * Empty string / INVALID_PHONE is treated as invalid.
 */
export function isPhoneValid(raw: string | null | undefined): boolean {
  const normalized = normalizePhoneE164(raw);
  if (!normalized) return false;
  try {
    return isValidPhoneNumber(normalized);
  } catch {
    return false;
  }
}

/**
 * Build a WhatsApp deep-link URL for any phone number.
 * Strips the leading '+' since wa.me expects digits only.
 *
 * @param raw   Raw or normalized phone number
 * @returns     wa.me URL string, or null if the number cannot be normalized
 *
 * @example
 *   waPhoneLink('01012345678')  // 'https://wa.me/20101234578'
 */
export function waPhoneLink(raw: string | null | undefined): string | null {
  const e164 = normalizePhoneE164(raw);
  if (!e164) return null;
  // wa.me expects the number without '+' prefix
  const digits = e164.startsWith('+') ? e164.slice(1) : e164;
  return `https://wa.me/${digits}`;
}

/**
 * Format a phone number for display purposes (national format for EG,
 * international E.164 for other countries). Falls back to the raw string.
 *
 * @example
 *   formatPhoneDisplay('+20101234567')  // '0101 234 567' (EG national)
 *   formatPhoneDisplay('+16505550100')  // '+1 650 555 0100'
 */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return '';
  const e164 = normalizePhoneE164(raw);
  if (!e164) return raw;
  try {
    const parsed = parsePhoneNumber(e164);
    if (!parsed) return raw;
    // Show national format for Egyptian numbers (cleaner UX)
    if (parsed.country === 'EG') {
      return parsed.formatNational();
    }
    return parsed.formatInternational();
  } catch {
    return raw;
  }
}

/**
 * Normalizes a phone number as the user types (useful for live form feedback).
 * Returns a partially-formatted string using AsYouType; does NOT guarantee E.164.
 * Use `normalizePhoneE164` for storage / comparison.
 */
export function formatPhoneAsYouType(
  partial: string,
  defaultCountry: CountryCode = 'EG'
): string {
  if (!partial) return '';
  const pre = preProcess(partial);
  return new AsYouType(defaultCountry).input(pre);
}

// ---------------------------------------------------------------------------
// Duplicate detection helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when two raw phone strings refer to the same normalized number.
 * Both sides are independently normalized before comparison.
 */
export function phonesAreEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizePhoneE164(a);
  const nb = normalizePhoneE164(b);
  return !!na && !!nb && na === nb;
}

/**
 * Detect all duplicate groups in an array of raw phone strings.
 * Returns a Map<normalizedPhone → indices[]> for each group that has > 1 entry.
 *
 * @example
 *   findPhoneDuplicates(['01012345678', '+2010 1234 5678', '0101 234 5679'])
 *   // Map { '+2010 1234 5678' → [0, 1] }
 */
export function findPhoneDuplicates(phones: (string | null | undefined)[]): Map<string, number[]> {
  const seen = new Map<string, number[]>();
  phones.forEach((raw, idx) => {
    const norm = normalizePhoneE164(raw);
    if (!norm) return;
    if (!seen.has(norm)) seen.set(norm, []);
    seen.get(norm)!.push(idx);
  });
  const duplicates = new Map<string, number[]>();
  seen.forEach((indices, norm) => {
    if (indices.length > 1) duplicates.set(norm, indices);
  });
  return duplicates;
}
