import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppData, ClassTimetable, Lesson } from './types';

const STORAGE_KEY = 'auch:app:v2';
const LEGACY_KEY = 'auch:app:v1';

export const EMPTY_DATA: AppData = {
  timetables: [],
  manualLessons: [],
  hidden: [],
  lastSyncedAt: null,
};

function normalizeTimetable(value: unknown): ClassTimetable | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Partial<ClassTimetable>;
  const config = entry.config as ClassTimetable['config'] | undefined;
  if (!config || typeof config.classId !== 'number') return null;
  return {
    config,
    lessons: Array.isArray(entry.lessons) ? entry.lessons : [],
  };
}

function normalizeManualLessons(value: unknown): Lesson[] {
  if (!Array.isArray(value)) return [];
  return value.filter((l): l is Lesson => l && typeof l === 'object' && typeof l.uid === 'string');
}

export async function loadAppData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AppData) : null;
    if (parsed) {
      const timetables = (Array.isArray(parsed.timetables) ? parsed.timetables : [])
        .map(normalizeTimetable)
        .filter((entry): entry is ClassTimetable => entry !== null);
      return {
        timetables,
        manualLessons: normalizeManualLessons(parsed.manualLessons),
        hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
        lastSyncedAt: typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null,
      };
    }

    // Migrate the v1 single-class shape.
    const legacyRaw = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      const entry = normalizeTimetable({
        config: legacy?.config,
        lessons: legacy?.lessons,
      });
      if (entry) {
        return {
          timetables: [entry],
          manualLessons: [],
          hidden: Array.isArray(legacy.hidden) ? legacy.hidden : [],
          lastSyncedAt: typeof legacy.lastSyncedAt === 'number' ? legacy.lastSyncedAt : null,
        };
      }
    }
    return EMPTY_DATA;
  } catch {
    return EMPTY_DATA;
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function clearAppData(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  await AsyncStorage.removeItem(LEGACY_KEY);
}