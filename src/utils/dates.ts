const MADRID_TZ = 'Europe/Madrid';

const DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTO = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/**
 * Returns today's date in Europe/Madrid timezone formatted as YYYY-MM-DD.
 */
export function getTodayMadridISO(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MADRID_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/**
 * Parses YYYY-MM-DD into numeric parts safely without timezone drift.
 */
export function parseISOParts(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return {
    year: Number.isFinite(y) ? y : 2026,
    month: Number.isFinite(m) ? m : 1,
    day: Number.isFinite(d) ? d : 1,
  };
}

/**
 * Returns weekday index (0 = Sunday .. 6 = Saturday) in Europe/Madrid for YYYY-MM-DD.
 */
export function getWeekdayIndex(iso: string): number {
  const { year, month, day } = parseISOParts(iso);
  // Use UTC noon to avoid any DST shift across Europe/Madrid
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return dt.getUTCDay();
}

/**
 * Formats YYYY-MM-DD as "sáb, 21 nov 2026".
 */
export function formatFechaLarga(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '—';
  const { year, month, day } = parseISOParts(iso);
  const wd = DIAS_CORTO[getWeekdayIndex(iso)];
  const mes = MESES_CORTO[month - 1] ?? 'ene';
  return `${wd}, ${day} ${mes} ${year}`;
}

/**
 * Formats YYYY-MM-DD as "21 nov 2026".
 */
export function formatFechaMedia(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '—';
  const { year, month, day } = parseISOParts(iso);
  const mes = MESES_CORTO[month - 1] ?? 'ene';
  return `${day} ${mes} ${year}`;
}

/**
 * Formats YYYY-MM-DD as "21 nov".
 */
export function formatFechaCorta(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
  const { month, day } = parseISOParts(iso);
  const mes = MESES_CORTO[month - 1] ?? 'ene';
  return `${day} ${mes}`;
}

/**
 * Formats YYYY-MM-DD as "sáb 21 nov" (for WhatsApp shift export).
 */
export function formatFechaWhatsApp(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
  const { month, day } = parseISOParts(iso);
  const wd = DIAS_CORTO[getWeekdayIndex(iso)];
  const mes = MESES_CORTO[month - 1] ?? 'ene';
  return `${wd} ${day} ${mes}`;
}

/**
 * Formats YYYY-MM-DD as "21/11/2026".
 */
export function formatFechaDDMMYYYY(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
  const { year, month, day } = parseISOParts(iso);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/**
 * Adds N days to an ISO date string (YYYY-MM-DD).
 */
export function addDaysISO(iso: string, days: number): string {
  const { year, month, day } = parseISOParts(iso);
  const dt = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns difference in days (isoA - isoB).
 */
export function diffDaysISO(isoA: string, isoB: string): number {
  const a = parseISOParts(isoA);
  const b = parseISOParts(isoB);
  const msA = Date.UTC(a.year, a.month - 1, a.day, 12, 0, 0);
  const msB = Date.UTC(b.year, b.month - 1, b.day, 12, 0, 0);
  return Math.round((msA - msB) / 86400000);
}

/**
 * Enumerates all ISO dates between startISO and endISO inclusive.
 */
export function listDatesInRange(startISO: string, endISO: string): string[] {
  if (startISO > endISO) return [];
  const res: string[] = [];
  let current = startISO;
  let guard = 0;
  while (current <= endISO && guard < 400) {
    res.push(current);
    current = addDaysISO(current, 1);
    guard += 1;
  }
  return res;
}

/**
 * Returns YYYY-MM prefix for current Europe/Madrid month.
 */
export function getCurrentMonthPrefix(): string {
  return getTodayMadridISO().slice(0, 7);
}
