import * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearAppData, EMPTY_DATA, loadAppData, saveAppData } from '@/lib/storage';
import { fetchLessons } from '@/lib/sync';
import { matchesRule, ruleFromLesson } from '@/lib/hidden';
import type { AppData, ClassTimetable, HiddenRule, Lesson, SyncConfig } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

interface SyncOutcome {
  ok: boolean;
  error: string | null;
}

interface CalendarContextValue {
  /** Whether stored data has been loaded from disk */
  hydrated: boolean;
  data: AppData;
  /** All lessons across every watched class, merged */
  lessons: Lesson[];
  syncing: boolean;
  syncError: string | null;
  isHidden: (lesson: Lesson) => boolean;
  hiddenRules: HiddenRule[];
  hideLesson: (lesson: Lesson) => Promise<void>;
  unhideRule: (ruleId: string) => Promise<void>;
  /** Adds a class (or replaces it if already watched) and syncs its timetable */
  addClass: (config: SyncConfig) => Promise<SyncOutcome>;
  /** Removes a watched class */
  removeClass: (config: SyncConfig) => Promise<void>;
  /** Refreshes the timetable of every watched class */
  syncNow: () => Promise<boolean>;
  /** Removes everything, returning to onboarding */
  resetAll: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

/** Two configs refer to the same class when both the class id and server match. */
function sameClass(a?: SyncConfig, b?: SyncConfig): boolean {
  if (!a || !b) return false;
  return a.classId === b.classId && a.baseUrl.trim().replace(/\/+$/, '') === b.baseUrl.trim().replace(/\/+$/, '');
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAppData().then((loaded) => {
      if (!cancelled) {
        setData(loaded);
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async (next: AppData | ((current: AppData) => AppData)) => {
      setData((current) => {
        const value = typeof next === 'function' ? next(current) : next;
        void saveAppData(value);
        return value;
      });
    },
    []
  );

  const isHidden = useCallback(
    (lesson: Lesson) => data.hidden.some((rule) => matchesRule(lesson, rule)),
    [data.hidden]
  );

  const hideLesson = useCallback(
    async (lesson: Lesson) => {
      const rule = ruleFromLesson(lesson);
      const exists = data.hidden.some((existing) => existing.id === rule.id);
      if (exists) return;
      await persist({
        ...data,
        hidden: [...data.hidden, rule],
      });
    },
    [data, persist]
  );

  const unhideRule = useCallback(
    async (ruleId: string) => {
      await persist({
        ...data,
        hidden: data.hidden.filter((rule) => rule.id !== ruleId),
      });
    },
    [data, persist]
  );

  /** Fetch a set of classes and merge them into the stored timetables. */
  const syncClasses = useCallback(
    async (targets: SyncConfig[]): Promise<SyncOutcome> => {
      setSyncing(true);
      setSyncError(null);
      try {
        const results = await Promise.all(
          targets.map((target) => fetchLessons(target.baseUrl, target.classId, target.dateRange))
        );
        const fetched: ClassTimetable[] = targets.map((config, i) => ({ config, lessons: results[i] }));

        await persist((current) => {
          const kept = current.timetables.filter(
            (existing) => !fetched.some((f) => sameClass(f.config, existing.config))
          );
          return {
            ...current,
            timetables: [...kept, ...fetched],
            lastSyncedAt: Date.now(),
          };
        });
        return { ok: true, error: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sync failed';
        setSyncError(message);
        return { ok: false, error: message };
      } finally {
        setSyncing(false);
      }
    },
    [persist]
  );

  const addClass = useCallback(async (config: SyncConfig) => syncClasses([config]), [syncClasses]);

  const removeClass = useCallback(
    async (config: SyncConfig) => {
      await persist({
        ...data,
        timetables: data.timetables.filter((entry) => !sameClass(entry.config, config)),
      });
    },
    [data, persist]
  );

  const syncNow = useCallback(async () => {
    if (data.timetables.length === 0) return false;
    const outcome = await syncClasses(data.timetables.map((entry) => entry.config));
    return outcome.ok;
  }, [data.timetables, syncClasses]);

  const resetAll = useCallback(async () => {
    await clearAppData();
    setData(EMPTY_DATA);
    setSyncError(null);
  }, []);

  const lessons = useMemo(() => {
    const seen = new Set<string>();
    const merged: Lesson[] = [];
    for (const entry of data.timetables) {
      for (const lesson of entry.lessons) {
        if (!seen.has(lesson.uid)) {
          seen.add(lesson.uid);
          merged.push(lesson);
        }
      }
    }
    return merged;
  }, [data.timetables]);

  const value = useMemo<CalendarContextValue>(
    () => ({
      hydrated,
      data,
      lessons,
      syncing,
      syncError,
      isHidden,
      hiddenRules: data.hidden,
      hideLesson,
      unhideRule,
      addClass,
      removeClass,
      syncNow,
      resetAll,
    }),
    [hydrated, data, lessons, syncing, syncError, isHidden, hideLesson, unhideRule, addClass, removeClass, syncNow, resetAll]
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar(): CalendarContextValue {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}