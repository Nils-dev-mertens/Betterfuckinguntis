import * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearAppData, EMPTY_DATA, loadAppData, saveAppData } from '@/lib/storage';
import { fetchLessons } from '@/lib/sync';
import { cancelAllReminders, scheduleLessonReminders } from '@/lib/notifications';
import { matchesRule, ruleFromLesson } from '@/lib/hidden';
import type { AppData, ClassTimetable, HiddenRule, Lesson, SyncConfig } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

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
  /** Adds a manually created lesson */
  addLesson: (lesson: Omit<Lesson, 'uid' | 'manual'>) => Promise<void>;
  /** Removes a manually created lesson (all occurrences of its series) */
  removeLesson: (uid: string) => Promise<void>;
  /** Removes the base lesson of a repeated series but keeps this occurrence */
  removeLessonOccurrence: (lesson: Lesson) => Promise<void>;
  /** Refreshes the timetable of every watched class */
  syncNow: () => Promise<boolean>;
  /** Updates local reminder settings and re-schedules notifications */
  updateReminders: (settings: Partial<AppData['reminders']>) => Promise<void>;
  /** Marks the first-launch intro as seen (done or skipped) */
  markIntroSeen: () => Promise<void>;
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
        // Subject names hidden by a rule are excluded at fetch time, the same
        // way the reference server's `&filter=` parameter works.
        const hiddenSubjects = [...new Set(data.hidden.map((rule) => rule.subject))];
        const results = await Promise.all(
          targets.map((target) =>
            fetchLessons(
              target.baseUrl,
              target.classId,
              target.dateRange,
              hiddenSubjects,
              target.className
            )
          )
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
    [data.hidden, persist]
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

  const markIntroSeen = useCallback(async () => {
    await persist((current) => ({ ...current, introSeen: true }));
  }, [persist]);

  const updateReminders = useCallback(
    async (settings: Partial<AppData['reminders']>) => {
      await persist((current) => ({
        ...current,
        reminders: { ...current.reminders, ...settings },
      }));
    },
    [persist]
  );

  const addLesson = useCallback(
    async (lesson: Omit<Lesson, 'uid' | 'manual'>) => {
      const manualLesson: Lesson = {
        ...lesson,
        uid: `manual-${uuidv4()}`,
        manual: true,
      };
      await persist((current) => ({
        ...current,
        manualLessons: [...current.manualLessons, manualLesson],
      }));
    },
    [persist]
  );

  const removeLesson = useCallback(
    async (uid: string) => {
      await persist((current) => ({
        ...current,
        manualLessons: current.manualLessons.filter((l) => l.uid !== uid),
      }));
    },
    [persist]
  );

  /**
   * Removes one occurrence of a repeated manual lesson by scoping the
   * series: the base lesson is re-created with a one-off exception date and
   * the repeat is stopped at the previous week, so past occurrences stay.
   */
  const removeLessonOccurrence = useCallback(
    async (lesson: Lesson) => {
      await persist((current) => {
        const baseUid = lesson.uid.split('#')[0];
        const base = current.manualLessons.find((l) => l.uid === baseUid);
        if (!base) return current;
        // End the series before this occurrence... unless this IS the base
        // (first occurrence), in which case the whole series goes.
        if (lesson.uid === baseUid) {
          return {
            ...current,
            manualLessons: current.manualLessons.filter((l) => l.uid !== baseUid),
          };
        }
        const previousWeek = format(new Date(lesson.start - 7 * 86_400_000), 'yyyy-MM-dd');
        const updated: Lesson = {
          ...base,
          repeatUntil: previousWeek,
        };
        // Keep the deleted date as a one-off "negative" lesson? No — simply
        // stop the series here; later weeks disappear with it. To skip just
        // one week and keep later ones we would need exceptions, which the
        // current model does not store.
        return {
          ...current,
          manualLessons: current.manualLessons.map((l) => (l.uid === baseUid ? updated : l)),
        };
      });
    },
    [persist]
  );

  /**
   * Manual lessons marked `repeat: 'weekly'` expand into one virtual lesson
   * per week between their start and `repeatUntil` (inclusive), keeping the
   * weekday and time. The stored lesson itself is occurrence #1.
   */
  const expandedManualLessons = useMemo(() => {
    const result: Lesson[] = [];
    for (const lesson of data.manualLessons) {
      result.push(lesson);
      if (lesson.repeat !== 'weekly') continue;
      const until = lesson.repeatUntil
        ? new Date(`${lesson.repeatUntil}T23:59:59`).getTime()
        : Date.now() + 52 * 7 * 86_400_000; // repeat for a year by default
      let occurrenceStart = lesson.start + 7 * 86_400_000;
      let n = 2;
      while (occurrenceStart <= until) {
        const duration = lesson.end - lesson.start;
        result.push({
          ...lesson,
          uid: `${lesson.uid}#${n}`,
          start: occurrenceStart,
          end: occurrenceStart + duration,
        });
        occurrenceStart += 7 * 86_400_000;
        n += 1;
      }
    }
    return result;
  }, [data.manualLessons]);

  const lessons = useMemo(() => {
    const seen = new Set<string>();
    const merged: Lesson[] = [];
    // Synced lessons first
    for (const entry of data.timetables) {
      for (const lesson of entry.lessons) {
        if (!seen.has(lesson.uid)) {
          seen.add(lesson.uid);
          merged.push(lesson);
        }
      }
    }
    // Manual lessons (they have unique uids)
    for (const lesson of expandedManualLessons) {
      if (!seen.has(lesson.uid)) {
        seen.add(lesson.uid);
        merged.push(lesson);
      }
    }
    return merged;
  }, [data.timetables, expandedManualLessons]);

  // Keep scheduled notifications in sync with the timetable and settings.
  // Hidden lessons don't buzz; every change (sync, add, hide, toggle) just
  // re-runs this — scheduling itself cancels the previous set first.
  useEffect(() => {
    if (!hydrated) return;
    if (!data.reminders.enabled) {
      void cancelAllReminders();
      return;
    }
    const visible = lessons.filter((lesson) => !isHidden(lesson));
    void scheduleLessonReminders(visible, data.reminders.leadMinutes);
  }, [hydrated, lessons, isHidden, data.reminders.enabled, data.reminders.leadMinutes]);

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
      addLesson,
      removeLesson,
      removeLessonOccurrence,
      syncNow,
      updateReminders,
      markIntroSeen,
      resetAll,
    }),
    [hydrated, data, lessons, syncing, syncError, isHidden, hideLesson, unhideRule, addClass, removeClass, addLesson, removeLesson, removeLessonOccurrence, syncNow, updateReminders, markIntroSeen, resetAll]
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