import {
  apiGetClasses,
  apiGetCurrentSchoolyear,
  apiGetSchoolyears,
  apiGetTimetable,
  mapClasses,
  mapTimetableToLessons,
  normalizeBaseUrl,
} from './webuntis';
import type { DateRange, Lesson, SchoolClass, SchoolYear } from './types';

/**
 * Data layer for the app. Talks to the WebUntis view REST API directly
 * (same source as the AP-WebUntisToICS-Node server), so no ICS provider is
 * needed. The base URL is the API root from that project's `.env.example`:
 * `https://ap.webuntis.com/WebUntis/api/rest/view/v1`.
 */

export const DEFAULT_BASE_URL = 'https://ap.webuntis.com/WebUntis/api/rest/view/v1';

/** Base URL for display purposes (strip the fixed API path). */
export function displayBaseUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.replace(/\/WebUntis\/api\/rest\/view\/v1$/i, '') || normalized;
}

/** Resolve a request range, falling back to the current school year. */
async function resolveRange(baseUrl: string, range?: DateRange): Promise<DateRange> {
  if (range?.start && range?.end) return range;
  const current = await apiGetCurrentSchoolyear(baseUrl);
  return current.dateRange;
}

export async function fetchSchoolyears(baseUrl: string): Promise<SchoolYear[]> {
  return apiGetSchoolyears(baseUrl);
}

export async function fetchClasses(baseUrl: string, range?: DateRange): Promise<SchoolClass[]> {
  return mapClasses(await apiGetClasses(baseUrl, await resolveRange(baseUrl, range)));
}

/**
 * Fetch the timetable of one class and map it to lessons. Subjects whose
 * name appears in `filter` (case-insensitive, trimmed) are left out — the
 * same behaviour as the reference server's `&filter=` parameter.
 */
export async function fetchLessons(
  baseUrl: string,
  classId: number,
  range?: DateRange,
  filter?: string[],
  sourceClass?: string
): Promise<Lesson[]> {
  const timetable = await apiGetTimetable(baseUrl, classId, await resolveRange(baseUrl, range));
  return mapTimetableToLessons(timetable, filter, sourceClass, classId);
}

export { normalizeBaseUrl };
