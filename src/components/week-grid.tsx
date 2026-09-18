import { isSameDay, format } from 'date-fns';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { subjectColor } from '@/lib/colors';
import { minutesOfDay } from '@/lib/time';
import type { Lesson } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

const HOUR_HEIGHT = 52;
const DEFAULT_DAY_START = 7; // 07:00
const DEFAULT_DAY_END = 20; // 20:00

interface WeekGridProps {
  days: Date[];
  lessonsForDay: (day: Date) => Lesson[];
  today: Date;
  onPressLesson: (lesson: Lesson) => void;
  /** Scroll the view so the current time is visible on mount. */
  scrollNowIntoView?: boolean;
}

interface PositionedLesson {
  lesson: Lesson;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
}

function dayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Greedy interval-column layout so overlapping lessons share the column
 * width instead of stacking on top of each other. Lessons that overlap
 * transitively (A-B-C where A and C don't intersect directly) are grouped
 * into one visual cluster.
 */
function layoutDay(lessons: Lesson[], dayStartMinutes: number): PositionedLesson[] {
  const sorted = [...lessons].sort((a, b) => a.start - b.start || a.end - b.end);
  const columnsEnds: number[] = [];
  const assigned = sorted.map((lesson) => {
    let column = columnsEnds.findIndex((end) => end <= lesson.start);
    if (column === -1) column = columnsEnds.length;
    columnsEnds[column] = Math.max(columnsEnds[column] ?? 0, lesson.end);
    return { lesson, column };
  });

  const positions: PositionedLesson[] = [];
  let i = 0;
  while (i < assigned.length) {
    const cluster: typeof assigned = [];
    let clusterEnd = assigned[i].lesson.end;
    let j = i;
    while (j < assigned.length && assigned[j].lesson.start < clusterEnd) {
      cluster.push(assigned[j]);
      clusterEnd = Math.max(clusterEnd, assigned[j].lesson.end);
      j += 1;
    }

    const columnCount = Math.max(...cluster.map((c) => c.column)) + 1;
    for (const { lesson, column } of cluster) {
      const startM = minutesOfDay(new Date(lesson.start));
      positions.push({
        lesson,
        top: (startM - dayStartMinutes) * (HOUR_HEIGHT / 60),
        height: Math.max(
          ((lesson.end - lesson.start) / 60000) * (HOUR_HEIGHT / 60),
          HOUR_HEIGHT * 0.5
        ),
        leftPct: (column / columnCount) * 100,
        widthPct: 100 / columnCount,
      });
    }
    i = j;
  }
  return positions;
}

function LessonCard({
  position,
  mini,
  onPress,
}: {
  position: PositionedLesson;
  mini: boolean;
  onPress: (lesson: Lesson) => void;
}) {
  const { lesson, top, height, leftPct, widthPct } = position;
  const color = subjectColor(lesson.subject);

  return (
    <Pressable
      onPress={() => onPress(lesson)}
      className="overflow-hidden rounded-md active:opacity-80"
      style={{
        position: 'absolute',
        top,
        height,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        backgroundColor: color.bg,
        borderLeftColor: color.accent,
        borderLeftWidth: mini ? 2 : 3,
      }}>
      <View className={mini ? 'px-0.5 py-0.5' : 'px-1 py-0.5'}>
        <Text
          className={cn(
            'font-bold leading-tight',
            mini ? 'text-[9px]' : 'text-[11px]'
          )}
          style={{ color: color.text }}
          numberOfLines={mini ? 2 : 2}>
          {lesson.subject}
        </Text>
        <Text
          className={cn(
            'mt-0.5 leading-tight text-muted-foreground tabular-nums',
            mini ? 'text-[8px]' : 'text-[9px]'
          )}>
          {format(lesson.start, 'HH:mm')}
        </Text>
      </View>
    </Pressable>
  );
}

export function WeekGrid({ days, lessonsForDay, today, onPressLesson, scrollNowIntoView = false }: WeekGridProps) {
  const scrollRef = useRef<ScrollView | null>(null);

  const { dayStart, dayEnd } = useMemo(() => {
    const minutes: number[] = [];
    for (const day of days) {
      for (const lesson of lessonsForDay(day)) {
        minutes.push(minutesOfDay(new Date(lesson.start)));
        minutes.push(minutesOfDay(new Date(lesson.end)) + 5);
      }
    }
    if (minutes.length === 0) return { dayStart: DEFAULT_DAY_START, dayEnd: DEFAULT_DAY_END };
    const min = Math.min(...minutes);
    const max = Math.max(...minutes);
    const start = Math.max(0, Math.min(DEFAULT_DAY_START, Math.floor(min / 60) - 1));
    // Bottom edge hugs the last lesson (+1h) but always shows at least 8h,
    // so early-afternoon days don't end in a tall empty band.
    const end = Math.min(24, Math.max(Math.ceil(max / 60) + 1, start + 8));
    return { dayStart: start, dayEnd: end };
  }, [days, lessonsForDay]);

  const hoursCount = dayEnd - dayStart;
  const dayStartMinutes = dayStart * 60;
  // Full week on a phone is 7 narrow columns: shrink info to the bare
  // minimum so everything always fits the screen width.
  const mini = days.length > 5;

  // On open, scroll so the current time sits ~1/3 from the top. The delay
  // lets the ScrollView finish its initial layout first.
  useEffect(() => {
    if (!scrollNowIntoView) return;
    const todayMinutes = minutesOfDay(new Date());
    if (todayMinutes < dayStartMinutes || todayMinutes > dayEnd * 60) return;
    const target = Math.max(
      0,
      (todayMinutes - dayStartMinutes) * (HOUR_HEIGHT / 60) - HOUR_HEIGHT * 2
    );
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: target, animated: false });
    }, 120);
    return () => clearTimeout(timer);
  }, [scrollNowIntoView, dayStartMinutes, dayEnd, days.length]);

  const renderDay = (day: Date, dayIndex: number) => {
    const isToday = isSameDay(day, today);
    const positions = layoutDay(lessonsForDay(day), dayStartMinutes);
    const nowLine = isToday
      ? (minutesOfDay(new Date()) - dayStartMinutes) * (HOUR_HEIGHT / 60)
      : null;

    return (
      <View
        key={dayKey(day)}
        className={cn(
          'min-w-0 flex-1 border-l border-border',
          dayIndex === 0 && 'border-l-0',
          isToday && 'bg-primary/[0.04]'
        )}>
        {/* Day header */}
        {mini ? (
          <View className="items-center border-b border-border px-0.5 py-1">
            <Text
              className={cn(
                'text-[9px] font-bold uppercase',
                isToday ? 'text-primary' : 'text-muted-foreground'
              )}>
              {format(day, 'EEEEE')}
            </Text>
            <Text
              className={cn(
                'text-xs font-extrabold leading-tight',
                isToday ? 'text-primary' : 'text-foreground'
              )}>
              {format(day, 'd')}
            </Text>
          </View>
        ) : (
          <View className="items-center border-b border-border px-1 py-1.5">
            <Text
              className={cn(
                'text-[10px] font-bold uppercase tracking-wide',
                isToday ? 'text-primary' : 'text-muted-foreground'
              )}>
              {format(day, 'EEE')}
            </Text>
            <Text
              className={cn(
                'text-sm font-extrabold leading-tight',
                isToday ? 'text-primary' : 'text-foreground'
              )}>
              {format(day, 'd')}
            </Text>
          </View>
        )}

        {/* Body */}
        <View style={{ height: hoursCount * HOUR_HEIGHT }}>
          {Array.from({ length: hoursCount }, (_, i) => {
            const top = (i + 1) * HOUR_HEIGHT - 1;
            const isHour = (dayStart + i + 1) % 12 !== 0;
            return (
              <View
                key={`${dayKey(day)}-${i}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: isHour ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.09)',
                }}
              />
            );
          })}
          {isToday && nowLine !== null && nowLine >= 0 && nowLine <= hoursCount * HOUR_HEIGHT && (
            <>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: nowLine,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: '#ef4444',
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: nowLine - 3,
                  left: -2,
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#ef4444',
                }}
              />
            </>
          )}
          {positions.map((position) => (
            <LessonCard
              key={position.lesson.uid}
              position={position}
              mini={mini}
              onPress={onPressLesson}
            />
          ))}
        </View>
      </View>
    );
  };

  // Columns share the width via flex; no fixed widths, no horizontal scroll.
  return (
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      className="flex-1 w-full">
      <View className="w-full flex-row">{days.map(renderDay)}</View>
    </ScrollView>
  );
}
