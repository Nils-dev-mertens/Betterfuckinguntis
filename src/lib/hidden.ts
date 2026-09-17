import type { HiddenRule, Lesson } from './types';

function minutesSinceMidnight(date: number): number {
  const d = new Date(date);
  return d.getHours() * 60 + d.getMinutes();
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
 * teachers or rooms differ by a minute).
 */
export function matchesRule(lesson: Lesson, rule: HiddenRule): boolean {
  if (rule.subject.toLowerCase() !== lesson.subject.toLowerCase()) return false;
  if (rule.info.toLowerCase() !== (lesson.info ?? '').toLowerCase()) return false;

  const { start } = lessonMinutes(lesson);
  if (Math.abs(start - rule.startMinutes) > 1) return false;

  const day = lessonDayOfWeek(lesson);
  if (day !== rule.dayOfWeek) return false;

  if (rule.teachers.length > 0 && lesson.teachers.length > 0) {
    const ruleSet = new Set(rule.teachers.map((t) => t.toLowerCase()));
    if (!lesson.teachers.some((t) => ruleSet.has(t.toLowerCase()))) return false;
  }

  return true;
}

const SLOT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ruleLabelForLesson(lesson: Lesson): string {
  const { start } = lessonMinutes(lesson);
  const hh = String(Math.floor(start / 60)).padStart(2, '0');
  const mm = String(start % 60).padStart(2, '0');
  const dayName = SLOT_DAY_NAMES[lessonDayOfWeek(lesson)];
  const suffix = lesson.info ? ` (${lesson.info})` : '';
  return `${lesson.subject}${suffix} · ${dayName} ${hh}:${mm}`;
}

export function ruleFromLesson(lesson: Lesson): HiddenRule {
  return {
    id: [
      lesson.subject.toLowerCase(),
      lesson.info.toLowerCase(),
      String(lessonDayOfWeek(lesson)),
      String(minutesSinceMidnight(lesson.start)),
      String(lessonDurationMinutes(lesson)),
      ...lesson.teachers.map((t) => t.toLowerCase()).sort(),
    ].join('|'),
    label: ruleLabelForLesson(lesson),
    subject: lesson.subject,
    info: lesson.info ?? '',
    dayOfWeek: lessonDayOfWeek(lesson),
    startMinutes: minutesSinceMidnight(lesson.start),
    durationMinutes: lessonDurationMinutes(lesson),
    teachers: [...lesson.teachers],
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