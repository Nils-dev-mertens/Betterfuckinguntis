import type { HiddenRule, Lesson } from './types';

function minutesSinceMidnight(date: number): number {
  const d = new Date(date);
  return d.getHours() * 60 + d.getMinutes();
}

/** Local `YYYY-MM-DD` key of an epoch timestamp (the school's wall-clock date). */
function isoDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function lessonMinutes(lesson: Lesson): { start: number; end: number } {
  return {
    start: minutesSinceMidnight(lesson.start),
    end: minutesSinceMidnight(lesson.end),
  };
}

export function lessonDayOfWeek(lesson: Lesson): number {
  return new Date(lesson.start).getDay();
}

export function lessonDurationMinutes(lesson: Lesson): number {
  return Math.round((lesson.end - lesson.start) / 60000);
}

/**
 * Matches a lesson against a hidden rule. Rules are normalised so that a rule
 * created from one week also hides the same slot in earlier and future weeks:
 * subject + info compare case-insensitively, the day of the week must match,
 * and the start time must be within a small tolerance (handles offsets when
 * teachers or rooms differ by a minute). A rule with `dates` additionally
 * only hides those dates, so "hide the next 3 weeks" stays limited to them.
 */
export function matchesRule(lesson: Lesson, rule: HiddenRule): boolean {
  if (rule.subject.toLowerCase() !== lesson.subject.toLowerCase()) return false;
  if (rule.info.toLowerCase() !== (lesson.info ?? '').toLowerCase()) return false;

  const { start } = lessonMinutes(lesson);
  if (Math.abs(start - rule.startMinutes) > 1) return false;

  const day = lessonDayOfWeek(lesson);
  if (day !== rule.dayOfWeek) return false;

  if (rule.dates && rule.dates.length > 0 && !rule.dates.includes(isoDate(lesson.start))) {
    return false;
  }

  if (rule.teachers.length > 0 && lesson.teachers.length > 0) {
    const ruleSet = new Set(rule.teachers.map((t) => t.toLowerCase()));
    if (!lesson.teachers.some((t) => ruleSet.has(t.toLowerCase()))) return false;
  }

  return true;
}

/** Indexed by `lessonDayOfWeek` (0 = Sunday, like Date.getDay). */
export const SLOT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ruleLabelForLesson(lesson: Lesson, dates?: string[]): string {
  const { start } = lessonMinutes(lesson);
  const hh = String(Math.floor(start / 60)).padStart(2, '0');
  const mm = String(start % 60).padStart(2, '0');
  const dayName = SLOT_DAY_NAMES[lessonDayOfWeek(lesson)];
  const suffix = lesson.info ? ` (${lesson.info})` : '';
  const scope =
    dates && dates.length > 0 ? ` · ${dates.length === 1 ? '1 week' : `${dates.length} weeks`}` : '';
  return `${lesson.subject}${suffix} · ${dayName} ${hh}:${mm}${scope}`;
}

/**
 * The lesson's own weekday for `weeks` consecutive weeks, starting with the
 * lesson's week. Built from calendar fields (never by adding milliseconds) so
 * a daylight-saving change can't shift the weekday.
 */
export function weekDatesFrom(lesson: Lesson, weeks: number): string[] {
  const count = Math.max(1, Math.min(52, Math.round(weeks)));
  const start = new Date(lesson.start);
  return Array.from({ length: count }, (_, index) =>
    isoDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index * 7).getTime())
  );
}

/**
 * How long a rule hides its slot, as text: `every week`, `this week only` or
 * `the next 3 weeks`.
 */
export function ruleScopeText(rule: HiddenRule): string {
  const weeks = rule.dates?.length ?? 0;
  if (weeks === 0) return 'every week';
  return weeks === 1 ? 'this week only' : `the next ${weeks} weeks`;
}

export function ruleFromLesson(lesson: Lesson, dates?: string[]): HiddenRule {
  const scoped = dates && dates.length > 0 ? dates : null;
  return {
    id: [
      lesson.subject.toLowerCase(),
      lesson.info.toLowerCase(),
      String(lessonDayOfWeek(lesson)),
      String(minutesSinceMidnight(lesson.start)),
      String(lessonDurationMinutes(lesson)),
      ...lesson.teachers.map((t) => t.toLowerCase()).sort(),
      // Scope belongs to the id: "this week only" and "every week" are
      // different rules and must be able to exist side by side.
      ...(scoped ?? []),
    ].join('|'),
    label: ruleLabelForLesson(lesson, scoped ?? undefined),
    subject: lesson.subject,
    info: lesson.info ?? '',
    dayOfWeek: lessonDayOfWeek(lesson),
    startMinutes: minutesSinceMidnight(lesson.start),
    durationMinutes: lessonDurationMinutes(lesson),
    teachers: [...lesson.teachers],
    dates: scoped ?? undefined,
    createdAt: Date.now(),
  };
}

/** Count of lessons (in a given list) that a rule currently hides. */
export function countHiddenForRule(rule: HiddenRule, lessons: Lesson[]): number {
  let count = 0;
  for (const lesson of lessons) {
    if (matchesRule(lesson, rule)) count += 1;
  }
  return count;
}