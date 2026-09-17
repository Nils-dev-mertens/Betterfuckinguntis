import { Platform } from 'react-native';
import type { DateRange, Lesson, SchoolClass, SchoolYear } from './types';
import { parseIcs } from './ics';

const DEFAULT_BASE_URL = 'https://ap.webuntis.viovyx.com';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/**
 * Browsers block direct requests to the provider because it sends no CORS
 * headers. On web we go through the same-origin `/proxy` endpoint of the
 * bundled server (`server/index.ts`). React Native doesn't enforce CORS, so
 * native calls hit the provider directly.
 */
function resolveEndpoint(target: string): string {
  if (Platform.OS !== 'web') return target;
  if (typeof window === 'undefined') return target;
  if (window.location.protocol === 'file:') return target;
  return `${window.location.origin}/proxy?url=${encodeURIComponent(target)}`;
}

function buildUrl(baseUrl: string, path: string, params?: Record<string, string | undefined>): string {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  return resolveEndpoint(url.toString());
}

/** Fetch helper with a timeout; throws human readable errors. */
async function fetchWithTimeout(url: string, timeoutMs = 20_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status} ${response.statusText})`);
    }
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The request timed out. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Describe what a response looked like so a bad reply is diagnosable. */
function describeBody(response: Response, body: string): string {
  const ctype = response.headers.get('content-type') ?? 'unknown';
  const head = body.trim().replace(/\s+/g, ' ').slice(0, 100);
  return `expected JSON, got "${ctype}" (${response.status}): ${head || '(empty body)'}`;
}

/** Parse a reply as JSON or throw a descriptive error (not a raw parse error). */
async function jsonOf<T>(response: Response): Promise<T> {
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`The server at ${response.url} was not reachable correctly; ${describeBody(response, body)}`);
  }
}

/** The calendar endpoint returns ICS text; reject HTML error pages early. */
async function icsOf(response: Response): Promise<string> {
  const body = await response.text();
  if (body.trim().startsWith('<')) {
    throw new Error(`The server at ${response.url} sent HTML instead of a calendar; ${describeBody(response, body)}`);
  }
  return body;
}

export async function fetchSchoolyears(baseUrl: string): Promise<SchoolYear[]> {
  const response = await fetchWithTimeout(buildUrl(baseUrl, '/schoolyears'));
  return jsonOf<SchoolYear[]>(response);
}

export async function fetchClasses(baseUrl: string, range?: DateRange): Promise<SchoolClass[]> {
  const response = await fetchWithTimeout(
    buildUrl(baseUrl, '/classes', {
      start: range?.start,
      end: range?.end,
    })
  );
  return jsonOf<SchoolClass[]>(response);
}

export async function fetchLessons(
  baseUrl: string,
  classId: number,
  range?: DateRange
): Promise<Lesson[]> {
  const response = await fetchWithTimeout(
    buildUrl(baseUrl, '/calendar', {
      class: String(classId),
      start: range?.start,
      end: range?.end,
    })
  );
  return parseIcs(await icsOf(response));
}

export { DEFAULT_BASE_URL, normalizeBaseUrl };