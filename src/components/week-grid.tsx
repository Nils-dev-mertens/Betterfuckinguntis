import { isSameDay, format } from 'date-fns';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { lightSubjectColor, subjectColor } from '@/lib/colors';
import { useTheme } from '@/context/theme-context';
import { minutesOfDay } from '@/lib/time';
import type { Lesson } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

const HOUR_HEIGHT = 64;
const TIME_AXIS_WIDTH = 40;
/** Fixed day-header heights; the hour axis spacer must match exactly. */
const DAY_HEADER_HEIGHT_COMPACT = 36;
const DAY_HEADER_HEIGHT = 48;
const DEFAULT_DAY_START = 7; // 07:00
const DEFAULT_DAY_END = 20; // 20:00

interface WeekGridProps {
  days: Date[];
  lessonsForDay: (day: Date) => Lesson[];
  today: Date;
  onPressLesson: (lesson: Lesson) => void;
  /** Scroll the view so the current time is visible on mount. */
  scrollNowIntoView?: boolean;
  /**
   * Fixed hour range shared by every view, derived in CalendarScreen from
   * ALL visible lessons. When given, the grid never re-scales per page:
   * navigating days/weeks keeps the same axis start/end and table height.
   */
  timeRange?: { start: number; end: number };
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

/**
 * Hour labels to the left of the grid. Each label is centered exactly on
 * its hour line (the lines sit at the top edge of each hour row), and the
 * axis lives inside the scroll content so labels can never drift out of
 * alignment while scrolling. The current hour is highlighted and a red
 * bubble marks "now".
 */
function TimeAxis({
  startHour,
  hoursCount,
  nowMinutes,
  mini,
}: {
  startHour: number;
  hoursCount: number;
  nowMinutes: number;
  mini: boolean;
}) {
  const nowVisible = nowMinutes >= startHour * 60 && nowMinutes <= (startHour + hoursCount) * 60;
  const nowOffset = (nowMinutes - startHour * 60) * (HOUR_HEIGHT / 60);
  const headerHeight = mini ? DAY_HEADER_HEIGHT_COMPACT : DAY_HEADER_HEIGHT;

  return (
    <View
      className="flex-shrink-0"
      style={{ width: TIME_AXIS_WIDTH }}
      pointerEvents="none">
      {/* Spacer aligning with the day headers; its bottom border row is the
          first hour line (startHour). */}
      <View style={{ height: headerHeight }} />
      <View style={{ height: hoursCount * HOUR_HEIGHT }}>
        {/* Labels for startHour .. dayEnd-1, each centered on the line at
            k * HOUR_HEIGHT (k = 0 is the header border itself). No label at
            the very bottom edge — it would clip against the content end. */}
        {Array.from({ length: hoursCount }, (_, k) => {
          const hour = startHour + k;
          const isNow = nowVisible && nowMinutes >= hour * 60 && nowMinutes < (hour + 1) * 60;
          return (
            <View
              key={hour}
              style={{
                position: 'absolute',
                top: k * HOUR_HEIGHT - 9,
                left: 0,
                right: 4,
                height: 18,
                justifyContent: 'center',
              }}>
              <Text
                className={cn(
                  'text-right tabular-nums',
                  mini ? 'text-[12px]' : 'text-[13px]',
                  isNow
                    ? 'font-bold text-destructive'
                    : 'font-semibold text-foreground/90'
                )}>
                {String(hour).padStart(2, '0')}
              </Text>
            </View>
          );
        })}
        {nowVisible ? (
          <View
            className="absolute left-0 right-1 items-end"
            style={{ top: nowOffset - 9 }}>
            <View className="rounded bg-destructive px-1.5 py-0.5">
              <Text className="text-[10px] font-bold tabular-nums text-destructive-foreground">
                {format(new Date(), 'HH:mm')}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
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
  const { isDark } = useTheme();
  const color = isDark
    ? subjectColor(lesson.subject, lesson.color)
    : lightSubjectColor(lesson.subject, lesson.color);

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
          {mini ? '' : `–${format(lesson.end, 'HH:mm')}`}
        </Text>
      </View>
    </Pressable>
  );
}

export function WeekGrid({
  days,
  lessonsForDay,
  today,
  onPressLesson,
  scrollNowIntoView = false,
  timeRange,
}: WeekGridProps) {
  const scrollRef = useRef<ScrollView | null>(null);
  const { isDark } = useTheme();

  const { dayStart, dayEnd } = useMemo(() => {
    // Shared range from CalendarScreen: every page renders the exact same
    // hour axis, so tables never change size while navigating.
    if (timeRange) return { dayStart: timeRange.start, dayEnd: timeRange.end };
    // Fallback (no shared range given): fit to the days shown.
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
  }, [timeRange, days, lessonsForDay]);

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
        {/* Day header — fixed height so the hour axis stays aligned */}
        {mini ? (
          <View
            className="items-center justify-center border-b border-border px-0.5"
            style={{ height: DAY_HEADER_HEIGHT_COMPACT }}>
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
          <View
            className="items-center justify-center border-b border-border px-1"
            style={{ height: DAY_HEADER_HEIGHT }}>
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
            const isNoonLine = (dayStart + i + 1) % 12 === 0;
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
                  backgroundColor: isNoonLine
                    ? isDark
                      ? 'rgba(255,255,255,0.18)'
                      : 'rgba(0,0,0,0.15)'
                    : isDark
                      ? 'rgba(255,255,255,0.10)'
                      : 'rgba(0,0,0,0.08)',
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
                  backgroundColor: 'hsl(var(--destructive))',
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
                  backgroundColor: 'hsl(var(--destructive))',
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

  // Columns share the width via flex; a slim hour axis sits on the left of
  // every mode so card positions can be read without counting day headers.
  // The axis lives INSIDE the ScrollView: labels scroll together with the
  // hour lines and cards, so they stay perfectly aligned at any offset.
  return (
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      className="flex-1 w-full">
      <View className="w-full flex-row">
        <TimeAxis
          startHour={dayStart}
          hoursCount={hoursCount}
          nowMinutes={minutesOfDay(new Date())}
          mini={mini}
        />
        {days.map(renderDay)}
      </View>
    </ScrollView>
  );
}
