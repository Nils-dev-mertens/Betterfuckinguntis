import * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { matchesRule, ruleFromLesson } from '@/lib/hidden';
import { clearAppData, EMPTY_DATA, loadAppData, saveAppData } from '@/lib/storage';
import { fetchLessons } from '@/lib/sync';
import type { AppData, HiddenRule, Lesson, SyncConfig } from '@/lib/types';

interface CalendarContextValue {
  /** Whether stored data has been loaded from disk */
  hydrated: boolean;
  data: AppData;
  syncing: boolean;
  syncError: string | null;
  isHidden: (lesson: Lesson) => boolean;
  hiddenRules: HiddenRule[];
  hideLesson: (lesson: Lesson) => Promise<void>;
  unhideRule: (ruleId: string) => Promise<void>;
  /** Refreshes the timeline using the stored config */
  syncNow: () => Promise<boolean>;
  /** Configures a class and performs the initial sync */
  completeSetup: (config: SyncConfig) => Promise<boolean>;
  /** Removes everything, returning to onboarding */
  resetAll: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

function emptyWith(overrides: Partial<AppData>): AppData {
  return { ...EMPTY_DATA, ...overrides };
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

  const persist = useCallback(async (next: AppData) => {
    setData(next);
    await saveAppData(next);
  }, []);

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

  const applySync = useCallback(async (config: SyncConfig) => {
    setSyncing(true);
    setSyncError(null);
    try {
      const lessons = await fetchLessons(config.baseUrl, config.classId, config.dateRange);
      setData((current) => {
        const next: AppData = {
          config,
          lessons,
          // Keep hidden classes only if still watching the same class.
          hidden: current.config?.classId === config.classId ? current.hidden : [],
          lastSyncedAt: Date.now(),
        };
        void saveAppData(next);
        return next;
      });
      return true;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
      return false;
    } finally {
      setSyncing(false);
    }
  }, []);

  const completeSetup = useCallback(
    async (config: SyncConfig) => applySync(config),
    [applySync]
  );

  const syncNow = useCallback(async () => {
    if (!data.config) return false;
    return applySync(data.config);
  }, [data.config, applySync]);

  const resetAll = useCallback(async () => {
    await clearAppData();
    setData(EMPTY_DATA);
    setSyncError(null);
  }, []);

  const value = useMemo<CalendarContextValue>(
    () => ({
      hydrated,
      data,
      syncing,
      syncError,
      isHidden,
      hiddenRules: data.hidden,
      hideLesson,
      unhideRule,
      syncNow,
      completeSetup,
      resetAll,
    }),
    [hydrated, data, syncing, syncError, isHidden, hideLesson, unhideRule, syncNow, completeSetup, resetAll]
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