/**
 * Returns a YYYY-MM-DD formatted date string representing the local date in the user's timezone.
 * Avoids UTC offset bugs caused by `new Date().toISOString().split('T')[0]` after midnight.
 */
export function getTodayLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns true if the given date is strictly in the future (after today's 23:59:59).
 * Prevents calendar pickers from incorrectly disabling "today".
 */
export function isFutureDate(date: Date): boolean {
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return date > todayEnd;
}
