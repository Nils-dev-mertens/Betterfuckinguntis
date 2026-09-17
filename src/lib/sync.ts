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

export async function fetchSchoolyears(baseUrl: string): Promise<SchoolYear[]> {
  const response = await fetchWithTimeout(buildUrl(baseUrl, '/schoolyears'));
  return (await response.json()) as SchoolYear[];
}

export async function fetchClasses(baseUrl: string, range?: DateRange): Promise<SchoolClass[]> {
  const response = await fetchWithTimeout(
    buildUrl(baseUrl, '/classes', {
      start: range?.start,
      end: range?.end,
    })
  );
  return (await response.json()) as SchoolClass[];
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
  const ics = await response.text();
  return parseIcs(ics);
}

export { DEFAULT_BASE_URL, normalizeBaseUrl };