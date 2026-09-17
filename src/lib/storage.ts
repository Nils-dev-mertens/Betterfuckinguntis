import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppData } from './types';

const STORAGE_KEY = 'auch:app:v1';

export const EMPTY_DATA: AppData = {
  config: null,
  lessons: [],
  hidden: [],
  lastSyncedAt: null,
};

export async function loadAppData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DATA;
    const parsed = JSON.parse(raw) as AppData;
    return {
      config: parsed.config ?? null,
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
      lastSyncedAt: typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null,
    };
  } catch {
    return EMPTY_DATA;
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function clearAppData(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}