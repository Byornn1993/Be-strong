// Datumhulpen. Regels:
//  * We bewaren timestamps altijd met tijdzone-offset (ISO 8601).
//  * Groeperen gebeurt op de LOKALE dag van het toestel, zodat 23:30 niet op de volgende dag belandt.
//  * Weken beginnen op maandag (nl-BE).

const pad = (n: number, len = 2) => String(Math.trunc(Math.abs(n))).padStart(len, '0');

/** ISO-string in lokale tijd met offset, bv. 2026-10-20T23:30:00.000+02:00 */
export function toLocalIso(d: Date): string {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${pad(off / 60)}:${pad(off % 60)}`
  );
}

/** Lokale dag als 'yyyy-mm-dd'. */
export function dayKey(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Lokale maand als 'yyyy-mm'. */
export function monthKey(input: string | Date): string {
  return dayKey(input).slice(0, 7);
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Maandag 00:00 (lokaal) van de week waarin d valt. */
export function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // ma=0 … zo=6
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

/** Week als dayKey van de maandag. */
export function weekKey(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return dayKey(startOfWeek(d));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Kalenderraster voor een maand: weken (ma–zo) met null voor dagen buiten de maand. */
export function monthGrid(year: number, month0: number): (Date | null)[][] {
  const first = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month0, i));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const dateFmt = new Intl.DateTimeFormat('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('nl-BE', { day: '2-digit', month: '2-digit' });
const longDateFmt = new Intl.DateTimeFormat('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('nl-BE', { month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('nl-BE', { hour: '2-digit', minute: '2-digit' });

/** dd/mm/jjjj */
export const formatDate = (iso: string | Date) => dateFmt.format(typeof iso === 'string' ? new Date(iso) : iso);
/** dd/mm */
export const formatShortDate = (iso: string | Date) => shortDateFmt.format(typeof iso === 'string' ? new Date(iso) : iso);
export const formatLongDate = (iso: string | Date) => longDateFmt.format(typeof iso === 'string' ? new Date(iso) : iso);
export const formatMonth = (d: Date) => monthFmt.format(d);
export const formatTime = (iso: string | Date) => timeFmt.format(typeof iso === 'string' ? new Date(iso) : iso);

/** 'yyyy-mm-dd' + 'HH:mm' (lokaal) → ISO met offset. */
export function localInputToIso(date: string, time = '12:00'): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return toLocalIso(new Date(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0));
}

/** ISO → 'HH:mm' voor <input type="time">. */
export function isoToTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
