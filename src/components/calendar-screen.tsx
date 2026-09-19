import { addDays, addWeeks, format, isSameDay } from 'date-fns';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, PanResponder, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Icon as ChevronLeft,
  Icon as ChevronRight,
  Icon as Settings2,
  Icon as RefreshCw,
  Icon as EyeOff,
  Icon as Plus,
} from '@/components/ui/icon';
import { CalendarHeader } from '@/components/calendar-header';
import { LessonSheet } from '@/components/lesson-sheet';
import { NowBanner } from '@/components/now-banner';
import { WeekAgenda } from '@/components/week-agenda';
import { WeekGrid } from '@/components/week-grid';
import { AddLessonSheet } from '@/components/add-lesson-sheet';
import { useCalendar } from '@/context/calendar-context';
import { weekDays, weekStartOf } from '@/lib/time';
import type { Lesson } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

type ViewMode = '3d' | '5d' | 'grid' | 'list';
/**
 * `null` = all watched classes combined; otherwise the WebUntis class id of
 * a watched class. Ids (not names) because names can repeat across years.
 */
type ClassFilter = number | null;

const SPANS: { key: ViewMode; label: string }[] = [
  { key: '3d', label: '3d' },
  { key: '5d', label: '5d' },
  { key: 'grid', label: 'Week' },
  { key: 'list', label: 'List' },
];

export function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, lessons, syncing, syncNow, isHidden, syncError, hiddenRules, addLesson } = useCalendar();

  /**
   * The only navigation state: any day the user is looking at. The displayed
   * week always starts on Monday (derived via weekStartOf), so it can never
   * drift — previously 3d/5d stepping mutated `weekStart` directly and the
   * Week view could open on e.g. a Thursday.
   */
  const [anchor, setAnchor] = React.useState<Date>(() => new Date());
  const [viewMode, setViewMode] = React.useState<ViewMode>('5d');
  const [selectedLesson, setSelectedLesson] = React.useState<Lesson | null>(null);
  const [showAddLesson, setShowAddLesson] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());
  /** Which watched class to show; `null` (default) combines them all. */
  const [classFilter, setClassFilter] = React.useState<ClassFilter>(null);

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const watchedClassCount = data.timetables.length;

  const visibleLessons = React.useMemo(() => {
    const unhidden = lessons.filter((lesson) => !isHidden(lesson));
    if (classFilter === null) return unhidden;
    // Strict match on the watched class id; never on lesson.classes (merged
    // lessons legitimately list other groups' codes).
    const exact = unhidden.filter((lesson) => lesson.sourceClassId === classFilter);
    if (exact.length > 0) return exact;
    // Data synced before sourceClassId existed: fall back to the name of
    // that watched class, still ignoring lesson.classes.
    const name = data.timetables.find((entry) => entry.config.classId === classFilter)?.config
      .className;
    return name ? unhidden.filter((lesson) => lesson.sourceClass === name) : exact;
  }, [lessons, isHidden, classFilter, data.timetables]);

  const lessonsForDay = React.useCallback(
    (day: Date) => {
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
      const dayEnd = dayStart + 86_400_000;
      return visibleLessons.filter(
        (lesson) => lesson.start >= dayStart && lesson.start < dayEnd
      );
    },
    [visibleLessons]
  );

  const days = React.useMemo(() => weekDays(weekStartOf(anchor)), [anchor]);

  /**
   * Days shown by the current view mode. 3d/5d roll from today, wrapping
   * into next week when the window would leave the displayed week.
   */
  const shownDays = React.useMemo(() => {
    if (viewMode === 'grid' || viewMode === 'list') return days;
    const count = viewMode === '3d' ? 3 : 5;
    const todayIndex = days.findIndex((day) => isSameDay(day, now));
    const anchorIndex = days.findIndex((day) => isSameDay(day, anchor));
    const index = anchorIndex >= 0 ? anchorIndex : todayIndex >= 0 ? todayIndex : 0;
    return Array.from({ length: count }, (_, i) => addDays(days[index] ?? days[0], i));
  }, [viewMode, days, now, anchor]);

  /**
   * Prev/next: weeks in Week/List; whole windows in 3d/5d. The anchor moves
   * by days, and Monday is re-derived from it every render, so stepping
   * across a week boundary keeps the Week view Monday-based.
   */
  const move = React.useCallback(
    (delta: number) => {
      if (viewMode === 'grid' || viewMode === 'list') {
        setAnchor((current) => addWeeks(current, delta));
        return;
      }
      setAnchor((current) => addDays(current, delta * (viewMode === '3d' ? 3 : 5)));
    },
    [viewMode]
  );

  const isTodayShown = shownDays.some((day) => isSameDay(day, now));

  const backToToday = React.useCallback(() => setAnchor(new Date()), []);

  /**
   * Horizontal swipe navigates prev/next (a window in 3d/5d, a week in
   * Week/List). Only claims clearly horizontal gestures so vertical
   * scrolling in the grid and agenda keeps working untouched.
   */
  const swipeResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx <= -30) move(1);
          else if (gesture.dx >= 30) move(-1);
        },
      }),
    [move]
  );

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}>
      <CalendarHeader
        currentWeek={weekStartOf(anchor)}
        label={
          viewMode === '3d' || viewMode === '5d'
            ? `${format(shownDays[0], 'EEE d MMM')} – ${format(shownDays[shownDays.length - 1], 'EEE d MMM')}`
            : undefined
        }
        caption={
          syncing
            ? 'Syncing…'
            : data.lastSyncedAt
              ? `Synced ${format(data.lastSyncedAt, 'd MMM · HH:mm')}`
              : 'Not synced yet'
        }
        onPrev={() => move(-1)}
        onNext={() => move(1)}
      />

      {/* Toolbar: spans left, actions right (synced time lives in the header) */}
      <View className="flex-row items-center justify-between gap-2 px-4 pb-2">
        <View className="flex-row items-center gap-1 rounded-md border border-border bg-secondary p-0.5">
          {SPANS.map((span) => (
            <Pressable
              key={span.key}
              onPress={() => setViewMode(span.key)}
              className={cn(
                'h-7 rounded px-2.5 items-center justify-center',
                viewMode === span.key ? 'bg-primary' : 'active:bg-accent'
              )}>
              <Text
                className={cn(
                  'text-xs font-semibold',
                  viewMode === span.key ? 'text-primary-foreground' : 'text-muted-foreground'
                )}>
                {span.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row items-center gap-1.5">
          <Pressable
            onPress={() => void syncNow()}
            disabled={syncing}
            accessibilityLabel="Sync now"
            className="h-8 w-8 items-center justify-center rounded-md bg-secondary active:bg-accent">
            {syncing ? (
              <ActivityIndicator size="small" color="hsl(var(--secondary-foreground))" />
            ) : (
              <RefreshCw size={15} color="hsl(var(--secondary-foreground))" as="refresh-cw" />
            )}
          </Pressable>
          <Pressable
            onPress={() => setShowAddLesson(true)}
            accessibilityLabel="Add lesson"
            className="h-8 w-8 items-center justify-center rounded-md bg-primary active:bg-primary/90">
            <Plus size={15} color="hsl(var(--primary-foreground))" as="plus" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityLabel="Open settings"
            className="h-8 w-8 items-center justify-center rounded-md bg-secondary active:bg-accent">
            <Settings2 size={15} color="hsl(var(--secondary-foreground))" as="settings" />
          </Pressable>
        </View>
      </View>

      {!isTodayShown && (
        <Pressable
          onPress={backToToday}
          className="mx-4 mb-2 flex-row items-center gap-1.5 self-start rounded-md border border-primary/40 bg-primary/10 px-3 py-1">
          <Text className="text-xs font-medium text-primary">Today</Text>
          <ChevronRight size={12} color="hsl(var(--primary))" as="chevron-right" />
        </Pressable>
      )}

      {syncError ? (
        <View className="mx-4 mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
          <Text className="text-xs font-medium text-destructive">Sync failed: {syncError}</Text>
        </View>
      ) : null}

      {watchedClassCount > 1 ? (
        <View className="mb-2 flex-row flex-wrap gap-1.5 px-4">
          <Pressable
            onPress={() => setClassFilter(null)}
            className={cn(
              'rounded-full border px-3 py-1',
              classFilter === null
                ? 'border-primary bg-primary/15'
                : 'border-border bg-secondary active:bg-accent'
            )}>
            <Text
              className={cn(
                'text-xs font-semibold',
                classFilter === null ? 'text-primary' : 'text-muted-foreground'
              )}>
              All combined
            </Text>
          </Pressable>
          {data.timetables.map((entry) => (
            <Pressable
              key={`${entry.config.classId}-${entry.config.schoolYear ?? ''}`}
              onPress={() => setClassFilter(entry.config.classId)}
              className={cn(
                'rounded-full border px-3 py-1',
                classFilter === entry.config.classId
                  ? 'border-primary bg-primary/15'
                  : 'border-border bg-secondary active:bg-accent'
              )}>
              <Text
                className={cn(
                  'text-xs font-semibold',
                  classFilter === entry.config.classId ? 'text-primary' : 'text-muted-foreground'
                )}>
                {entry.config.className}
                {entry.config.schoolYear ? ` (${entry.config.schoolYear})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {lessons.length > 0 && isTodayShown ? (
        <NowBanner lessons={visibleLessons} now={now} onPressLesson={setSelectedLesson} />
      ) : null}

      <View style={{ flex: 1 }} {...swipeResponder.panHandlers}>
        {lessons.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
          <View className="items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
              <EyeOff size={24} color="hsl(var(--muted-foreground))" as="eye-off" />
            </View>
            <Text className="text-center text-sm text-muted-foreground">
              No lessons to show. If this class should have data, check in Settings that the class
              belongs to the school year you want (each year runs Sept–Sept).
            </Text>
            <Pressable onPress={() => void syncNow()} className="mt-1 rounded-md bg-primary px-4 py-2 active:bg-primary/90">
              <Text className="text-sm font-semibold text-primary-foreground">Sync now</Text>
            </Pressable>
          </View>
        </View>
      ) : !shownDays.some((day) => lessonsForDay(day).length > 0) ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-muted-foreground">
            {classFilter !== null
              ? `No classes for ${
                  data.timetables.find((entry) => entry.config.classId === classFilter)?.config
                    .className ?? 'this class'
                } in the ${viewMode === 'list' ? 'week' : `${shownDays.length} days`} shown.`
              : `No classes in the ${viewMode === 'list' ? 'week' : `${shownDays.length} days`} shown.`}
            {'\n'}If you expected lessons here, check that your class is from the school year you
            want (Settings shows which year it belongs to).
          </Text>
        </View>
      ) : viewMode === 'grid' ? (
        <WeekGrid
          days={days}
          lessonsForDay={lessonsForDay}
          today={now}
          onPressLesson={setSelectedLesson}
          scrollNowIntoView={isTodayShown}
        />
      ) : viewMode === '3d' || viewMode === '5d' ? (
        <WeekGrid
          days={shownDays}
          lessonsForDay={lessonsForDay}
          today={now}
          onPressLesson={setSelectedLesson}
          scrollNowIntoView={isTodayShown}
        />
      ) : (
        <WeekAgenda
          days={days}
          lessonsForDay={lessonsForDay}
          today={now}
          onPressLesson={setSelectedLesson}
        />
      )}
      </View>

      <LessonSheet lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />
      <AddLessonSheet isOpen={showAddLesson} onClose={() => setShowAddLesson(false)} onAdd={addLesson} />

      {hiddenRules.length > 0 && (
        <View className="absolute bottom-3 right-3 flex-row items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 shadow-lg shadow-black/40">
          <EyeOff size={12} color="hsl(var(--muted-foreground))" as="eye-off" />
          <Text className="text-[11px] text-muted-foreground">
            {hiddenRules.length} class{hiddenRules.length === 1 ? '' : 'es'} hidden
          </Text>
        </View>
      )}
    </View>
  );
}