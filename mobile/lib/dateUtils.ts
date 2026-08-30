/**
 * Date utility to reliably get YYYY-MM-DD in the device's local timezone.
 * Avoids UTC timezone day-shift bugs when using .toISOString().split('T')[0].
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns UTC ISO strings for local start-of-day (00:00:00.000) and end-of-day (23:59:59.999).
 */
export function getLocalDayBoundsIso(dateStr: string): { startIso: string; endIso: string } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}
