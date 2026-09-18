import { Platform } from 'react-native';
import type { DateRange, Lesson, SchoolClass, SchoolYear } from './types';

/**
 * Direct client for the WebUntis view REST API that powers AP Hogeschool.
 *
 * Ported from the AP-WebUntisToICS-Node server (server/src/api.ts and
 * server/src/mappers.ts, https://github.com/Viovyx/AP-WebUntisToICS-Node)
 * so this app fetches timetables from ap.webuntis.com itself instead of
 * going through the ICS provider.
 *
 * All endpoints are anonymous GETs returning JSON; the school is selected
 * with the `anonymous-school` header. Responses are cached in memory with
 * the TTLs the reference server used: reference data (schoolyears, class
 * list, app data) 7 days, timetable entries 15 minutes.
 */

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

//#region Fetch plumbing

const REQUEST_TIMEOUT_MS = 20_000;
const LONG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SHORT_TTL_MS = 15 * 60 * 1000;

/**
 * Browsers block requests that carry the custom `anonymous-school` header:
 * the API answers CORS preflights without listing it in
 * `Access-Control-Allow-Headers`. On web we therefore go through the
 * same-origin `/proxy` endpoint of the bundled server (`server/index.ts`),
 * which forwards the header. React Native doesn't enforce CORS, so native
 * calls hit the API directly.
 */
function resolveEndpoint(target: string): string {
  if (Platform.OS !== 'web') return target;
  if (typeof window === 'undefined') return target;
  if (window.location.protocol === 'file:') return target;
  return `${window.location.origin}/proxy?url=${encodeURIComponent(target)}`;
}

/** WebUntis tenants live at `<school>.webuntis.com`; ap.webuntis.com -> `ap`. */
function schoolFromBaseUrl(baseUrl: string): string {
  try {
    const host = new URL(baseUrl).hostname;
    if (host.endsWith('.webuntis.com')) return host.replace(/\.webuntis\.com$/, '') || 'ap';
  } catch {
    // Unparsable base URL; fall back to the AP default below.
  }
  return 'ap';
}

interface CacheEntry {
  at: number;
  value: unknown;
}

const responseCache = new Map<string, CacheEntry>();

async function fetchJson<T>(
  baseUrl: string,
  path: string,
  params: Record<string, string>,
  ttlMs: number
): Promise<T> {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const cacheKey = url.toString();
  const hit = responseCache.get(cacheKey);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  const endpoint = resolveEndpoint(cacheKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { 'anonymous-school': schoolFromBaseUrl(baseUrl) },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The request timed out. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`WebUntis request failed (${response.status} ${response.statusText})`);
  }

  const body = await response.text();
  let json: T;
  try {
    json = JSON.parse(body) as T;
  } catch {
    // HTML instead of JSON means the proxy request fell through to a page
    // fallback — on web this happens when the static/proxy server is not
    // running (`bun run web:build && bun run web:serve`), since `bun start`
    // has no /proxy endpoint. Native never goes through the proxy.
    const looksHtml = /<!doctype html|<html[\s>]/i.test(body);
    throw new Error(
      looksHtml
        ? Platform.OS === 'web'
          ? 'Received a web page instead of data. Rebuild and serve the web app: bun run web:build && bun run web:serve.'
          : 'Received a web page instead of data. Check the server URL in Setup.'
        : `WebUntis returned invalid JSON (${response.status}): ${body
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 120) || '(empty body)'}`
    );
  }

  responseCache.set(cacheKey, { at: Date.now(), value: json });
  return json;
}

//#endregion

//#region API response types (subset of the WebUntis view API)

/** `2026-09-21T18:00` (school-local wall clock) or a full ISO timestamp. */
export function parseApiTimestamp(value: string): number {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/
  );
  if (!match) throw new Error(`Unsupported WebUntis timestamp: ${value}`);
  const [, y, m, d, hh = '0', mm = '0', ss = '0', msRaw = '0', tz] = match;
  const ms = Number(`${msRaw}00`.slice(0, 3));
  if (!tz) {
    // No timezone designator: wall-clock school time, keep it as-is.
    return new Date(+y, +m - 1, +d, +hh, +mm, +ss, ms).getTime();
  }
  const utc = Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss, ms);
  if (tz === 'Z') return utc;
  const sign = tz[0] === '-' ? -1 : 1;
  const digits = tz.slice(1).replace(':', '');
  const offsetMinutes = Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4));
  return utc - sign * offsetMinutes * 60_000;
}

export interface ApiResourceEl {
  id: number;
  shortName: string;
  longName: string;
  displayName: string;
}

export interface ApiClassResource {
  class: ApiResourceEl;
  classTeacher1: unknown;
  classTeacher2: unknown;
  department: ApiResourceEl;
}

export interface ApiPosition {
  current: {
    type: 'SUBJECT' | 'TEACHER' | 'ROOM' | 'INFO' | 'CLASS' | string;
    shortName: string;
    longName: string;
    displayName: string;
  };
}

export interface ApiGridEntry {
  duration: { start: string; end: string };
  lessonInfo?: string;
  position1?: ApiPosition[] | null;
  position2?: ApiPosition[] | null;
  position3?: ApiPosition[] | null;
  position4?: ApiPosition[] | null;
  position5?: ApiPosition[] | null;
  position6?: ApiPosition[] | null;
  position7?: ApiPosition[] | null;
}

export interface ApiDay {
  date: string;
  resource: ApiResourceEl;
  gridEntries?: ApiGridEntry[] | null;
}

export interface ApiTimetable {
  format: number;
  days?: ApiDay[] | null;
}

export interface ApiCurrentSchoolyear extends SchoolYear {
  timeGrid: unknown;
}

//#endregion

//#region API requests

export async function apiGetSchoolyears(baseUrl: string): Promise<SchoolYear[]> {
  return fetchJson<SchoolYear[]>(baseUrl, '/schoolyears', {}, LONG_TTL_MS);
}

export async function apiGetCurrentSchoolyear(baseUrl: string): Promise<ApiCurrentSchoolyear> {
  const data = await fetchJson<{ currentSchoolYear: ApiCurrentSchoolyear }>(
    baseUrl,
    '/app/data',
    {},
    LONG_TTL_MS
  );
  return data.currentSchoolYear;
}

export async function apiGetClasses(baseUrl: string, dateRange: DateRange): Promise<ApiClassResource[]> {
  const data = await fetchJson<{ classes: ApiClassResource[] }>(
    baseUrl,
    '/timetable/filter',
    { resourceType: 'CLASS', start: dateRange.start, end: dateRange.end },
    LONG_TTL_MS
  );
  return data.classes ?? [];
}

export async function apiGetTimetable(
  baseUrl: string,
  classId: number,
  dateRange: DateRange
): Promise<ApiTimetable> {
  return fetchJson<ApiTimetable>(
    baseUrl,
    '/timetable/entries',
    { resourceType: 'CLASS', start: dateRange.start, end: dateRange.end, resources: String(classId) },
    SHORT_TTL_MS
  );
}

//#endregion

//#region Mappers (ported from server/src/mappers.ts)

function mergeArrays(...arrays: string[][]): string[] {
  return [...new Set(arrays.flat())].sort();
}

interface CleanPositions {
  subjects: ApiPosition[];
  teachers: ApiPosition[];
  rooms: ApiPosition[];
  infos: ApiPosition[];
  classes: ApiPosition[];
}

function getEntryPositions(entry: ApiGridEntry): CleanPositions {
  const groups = [
    entry.position1,
    entry.position2,
    entry.position3,
    entry.position4,
    entry.position5,
    entry.position6,
    entry.position7,
  ];
  const positions: CleanPositions = {
    subjects: [],
    teachers: [],
    rooms: [],
    infos: [],
    classes: [],
  };
  for (const group of groups) {
    switch (group?.[0]?.current.type) {
      case 'SUBJECT':
        positions.subjects = group ?? [];
        break;
      case 'TEACHER':
        positions.teachers = group ?? [];
        break;
      case 'ROOM':
        positions.rooms = group ?? [];
        break;
      case 'INFO':
        positions.infos = group ?? [];
        break;
      case 'CLASS':
        positions.classes = group ?? [];
        break;
      default:
        break;
    }
  }
  return positions;
}

/** Map a raw timetable to lessons, dropping subjects named in `filter`. */
export function mapTimetableToLessons(
  timetable: ApiTimetable,
  filter?: string[],
  sourceClass?: string,
  sourceClassId?: number
): Lesson[] {
  const filterSubjects = (filter ?? [])
    .map((subject) => subject.trim().toLowerCase())
    .filter(Boolean);

  const lessons = new Map<string, Lesson>();
  for (const day of timetable.days ?? []) {
    for (const entry of day.gridEntries ?? []) {
      const positions = getEntryPositions(entry);
      const subject = positions.subjects[0]?.current.longName ?? 'No subject';
      const info = entry.lessonInfo ?? '';
      if (filterSubjects.some((name) => name === subject.toLowerCase())) continue;

      const lesson: Lesson = {
        uid: `wuc:${entry.duration.start}|${entry.duration.end}|${subject}|${info}`,
        start: parseApiTimestamp(entry.duration.start),
        end: parseApiTimestamp(entry.duration.end),
        subject,
        info,
        teachers: positions.teachers.map((teacher) => teacher.current.longName),
        locations: positions.rooms
          .map((room) => room.current.displayName)
          .sort(),
        classes: [
          ...positions.classes.map((classEl) => classEl.current.displayName),
          day.resource?.shortName ?? '',
        ]
          .filter(Boolean)
          .sort(),
        sourceClass,
        sourceClassId,
        manual: false,
      };

      // Same subject, info and timeslot appearing for multiple groups is
      // merged into one lesson (same behaviour as the reference server).
      const existing = lessons.get(lesson.uid);
      if (existing) {
        existing.teachers = mergeArrays(existing.teachers, lesson.teachers);
        existing.classes = mergeArrays(existing.classes, lesson.classes);
        existing.locations = mergeArrays(existing.locations, lesson.locations);
      } else {
        lessons.set(lesson.uid, lesson);
      }
    }
  }
  return [...lessons.values()].sort((a, b) => a.start - b.start);
}

export function mapClasses(raw: ApiClassResource[]): SchoolClass[] {
  return raw.map((entry) => ({
    id: entry.class.id,
    name: entry.class.displayName || entry.class.shortName || entry.class.longName,
  }));
}

//#endregion
