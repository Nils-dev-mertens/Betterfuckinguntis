import { addDays, format, startOfWeek } from 'date-fns';

export const WEEK_START = 1 as const; // Monday

export function weekStartOf(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: WEEK_START });
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function sameWeek(a: Date, b: Date): boolean {
  return weekStartOf(a).getTime() === weekStartOf(b).getTime();
}

export function formatWeekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  if (sameMonth) return `${format(weekStart, 'd')}–${format(end, 'd MMMM yyyy')}`;
  return `${format(weekStart, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
}

/** Minutes since midnight for a Date (local time). */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function lessonOverlapsRange(
  lessonStart: number,
  lessonEnd: number,
  rangeStart: number,
  rangeEnd: number
): boolean {
  return lessonStart < rangeEnd && lessonEnd > rangeStart;
}

export function formatTimeMinutes(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}