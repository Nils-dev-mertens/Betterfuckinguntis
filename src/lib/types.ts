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
  /** Base URL of the AP-WebUntisToICS provider, e.g. https://ap.webuntis.viovyx.com */
  baseUrl: string;
  classId: number;
  className: string;
  /** Selected schoolyear name, when a specific one is chosen */
  schoolYear?: string;
  /** Date range used to fetch the calendar */
  dateRange?: DateRange;
}

export interface AppData {
  config: SyncConfig | null;
  /** Clock of lessons fetched during the last successful sync */
  lessons: Lesson[];
  hidden: HiddenRule[];
  /** Epoch ms of the last successful sync */
  lastSyncedAt: number | null;
}