import { addDays, addWeeks, format, isSameWeek, subWeeks } from 'date-fns';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight, List, Settings2, CalendarDays, RefreshCw, EyeOff } from 'lucide-react-native';
import { CalendarHeader } from '@/components/calendar-header';
import { LessonSheet } from '@/components/lesson-sheet';
import { WeekAgenda } from '@/components/week-agenda';
import { WeekGrid } from '@/components/week-grid';
import { useCalendar } from '@/context/calendar-context';
import { lessonOverlapsRange, formatWeekLabel, weekDays, weekStartOf } from '@/lib/time';
import type { Lesson } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

type ViewMode = 'grid' | 'list';

export function CalendarScreen() {
  const router = useRouter();
  const { data, lessons, syncing, syncNow, isHidden, syncError, hiddenRules } = useCalendar();

  const [weekStart, setWeekStart] = React.useState<Date>(() => weekStartOf(new Date()));
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');
  const [selectedLesson, setSelectedLesson] = React.useState<Lesson | null>(null);
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const visibleLessons = React.useMemo(
    () => lessons.filter((lesson) => !isHidden(lesson)),
    [lessons, isHidden]
  );

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

  const days = React.useMemo(() => weekDays(weekStart), [weekStart]);
  const weekHasLesson = visibleLessons.some((lesson) =>
    lessonOverlapsRange(lesson.start, lesson.end, weekStart.getTime(), addDays(weekStart, 7).getTime())
  );

  const moveWeek = React.useCallback((delta: number) => {
    setWeekStart((current) => (delta < 0 ? subWeeks(current, 1) : addWeeks(current, 1)));
  }, []);

  const isThisWeek = isSameWeek(weekStart, now, { weekStartsOn: 1 });

  return (
    <View className="flex-1 bg-background">
      <CalendarHeader currentWeek={weekStart} onPrev={() => moveWeek(-1)} onNext={() => moveWeek(1)} />

      {/* Toolbar */}
      <View className="flex-row items-center justify-between px-4 pb-2">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setViewMode('grid')}
            className={cn(
              'h-8 w-8 items-center justify-center rounded-md',
              viewMode === 'grid' ? 'bg-primary' : 'bg-secondary active:bg-accent'
            )}>
            <CalendarDays size={16} color={viewMode === 'grid' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--secondary-foreground))'} />
          </Pressable>
          <Pressable
            onPress={() => setViewMode('list')}
            className={cn(
              'h-8 w-8 items-center justify-center rounded-md',
              viewMode === 'list' ? 'bg-primary' : 'bg-secondary active:bg-accent'
            )}>
            <List size={16} color={viewMode === 'list' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--secondary-foreground))'} />
          </Pressable>
        </View>

        <View className="flex-row items-center gap-2">
          {data.lastSyncedAt ? (
            <Text className="text-xs text-muted-foreground">
              synced {format(data.lastSyncedAt, 'd MMM · HH:mm')}
            </Text>
          ) : (
            <Text className="text-xs text-muted-foreground">not synced yet</Text>
          )}
          <Pressable
            onPress={() => void syncNow()}
            disabled={syncing}
            className="h-8 w-8 items-center justify-center rounded-md bg-secondary active:bg-accent">
            {syncing ? (
              <ActivityIndicator size="small" color="hsl(var(--secondary-foreground))" />
            ) : (
              <RefreshCw size={15} color="hsl(var(--secondary-foreground))" />
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityLabel="Open settings"
            className="h-8 w-8 items-center justify-center rounded-md bg-secondary active:bg-accent">
            <Settings2 size={15} color="hsl(var(--secondary-foreground))" />
          </Pressable>
        </View>
      </View>

      {!isThisWeek && (
        <Pressable
          onPress={() => setWeekStart(weekStartOf(new Date()))}
          className="mx-4 mb-2 flex-row items-center gap-1.5 self-start rounded-md border border-primary/40 bg-primary/10 px-3 py-1">
          <Text className="text-xs font-medium text-primary">Today</Text>
          <ChevronRight size={12} color="hsl(var(--primary))" />
        </Pressable>
      )}

      {syncError ? (
        <View className="mx-4 mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
          <Text className="text-xs font-medium text-destructive">Sync failed: {syncError}</Text>
        </View>
      ) : null}

      {lessons.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
              <EyeOff size={24} color="hsl(var(--muted-foreground))" />
            </View>
            <Text className="text-center text-sm text-muted-foreground">
              No classes synced yet.
              {'\n'}
              Pull “refresh” to fetch the schedule from{' '}
              {data.timetables[0]?.config.baseUrl ?? 'WebUntis'}.
            </Text>
            <Pressable onPress={() => void syncNow()} className="mt-1 rounded-md bg-primary px-4 py-2 active:bg-primary/90">
              <Text className="text-sm font-semibold text-primary-foreground">Sync now</Text>
            </Pressable>
          </View>
        </View>
      ) : !weekHasLesson ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-muted-foreground">
            No classes in the week of {formatWeekLabel(weekStart)}.
          </Text>
        </View>
      ) : viewMode === 'grid' ? (
        <WeekGrid
          days={days}
          lessonsForDay={lessonsForDay}
          today={now}
          onPressLesson={setSelectedLesson}
        />
      ) : (
        <WeekAgenda
          days={days}
          lessonsForDay={lessonsForDay}
          today={now}
          onPressLesson={setSelectedLesson}
        />
      )}

      <LessonSheet lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />

      {hiddenRules.length > 0 && viewMode === 'grid' && (
        <View className="absolute bottom-3 right-3 flex-row items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 shadow-lg shadow-black/40">
          <EyeOff size={12} color="hsl(var(--muted-foreground))" />
          <Text className="text-[11px] text-muted-foreground">
            {hiddenRules.length} class{hiddenRules.length === 1 ? '' : 'es'} hidden
          </Text>
        </View>
      )}
    </View>
  );
}