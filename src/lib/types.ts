export interface DateRange {
  /** ISO date `YYYY-MM-DD`, inclusive */
  start: string;
  /** ISO date `YYYY-MM-DD`, exclusive */
  end: string;
}

export interface SchoolYear {
  dateRange: DateRange;
  id: number;
  name: string;
}

export interface SchoolClass {
  id: number;
  name: string;
}

export interface Lesson {
  /** Stable identifier from the ICS uid */
  uid: string;
  /** Start time, epoch ms (wall-clock school time interpreted as local) */
  start: number;
  /** End time, epoch ms */
  end: number;
  /** Subject name, e.g. "Math" */
  subject: string;
  /** Optional subject info, e.g. "theory", "Exercises" */
  info: string;
  /** Teacher names */
  teachers: string[];
  /** Room / location names */
  locations: string[];
  /** Class names covered by this lesson */
  classes: string[];
  /** Watched class this lesson was fetched for (used for per-class filtering) */
  sourceClass?: string;
  /** WebUntis id of the watched class this lesson was fetched for */
  sourceClassId?: number;
  /** Whether this lesson was created manually (not from server sync) */
  manual?: boolean;
  /** Manual lessons only: repeat weekly on the same weekday until `repeatUntil` */
  repeat?: 'none' | 'weekly';
  /** ISO date (YYYY-MM-DD) of the last occurrence, inclusive; absent = repeat forever */
  repeatUntil?: string;
}

/** A rule that hides one recurring weekly class slot, now and in future weeks. */
export interface HiddenRule {
  id: string;
  /** Human readable label shown in settings */
  label: string;
  subject: string;
  info: string;
  /** 0 (Sunday) - 6 (Saturday), using weekday of the source lesson */
  dayOfWeek: number;
  /** Minutes since midnight of the source lesson start */
  startMinutes: number;
  /** Duration in minutes of the source lesson */
  durationMinutes: number;
  teachers: string[];
  createdAt: number;
}

export interface SyncConfig {
  /** API root of the WebUntis server, e.g. https://ap.webuntis.com/WebUntis/api/rest/view/v1 */
  baseUrl: string;
  classId: number;
  className: string;
  /** Selected schoolyear name, when a specific one is chosen */
  schoolYear?: string;
  /** Date range used to fetch the calendar */
  dateRange?: DateRange;
}

/** Stored lessons for one watched class. */
export interface ClassTimetable {
  config: SyncConfig;
  lessons: Lesson[];
}

export interface AppData {
  /** Every watched class with its fetched lessons */
  timetables: ClassTimetable[];
  /** Manually created lessons (not from server sync) */
  manualLessons: Lesson[];
  hidden: HiddenRule[];
  /** Epoch ms of the last successful sync */
  lastSyncedAt: number | null;
}