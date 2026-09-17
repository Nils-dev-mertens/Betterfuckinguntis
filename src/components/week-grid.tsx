import { isSameDay, format } from 'date-fns';
import { useMemo } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { subjectColor } from '@/lib/colors';
import { minutesOfDay } from '@/lib/time';
import type { Lesson } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

const HOUR_HEIGHT = 52;
const TIME_AXIS_WIDTH = 46;
const DEFAULT_DAY_START = 7; // 07:00
const DEFAULT_DAY_END = 20; // 20:00

interface WeekGridProps {
  days: Date[];
  lessonsForDay: (day: Date) => Lesson[];
  today: Date;
  onPressLesson: (lesson: Lesson) => void;
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

function TimeAxis({ startHour, hoursCount }: { startHour: number; hoursCount: number }) {
  return (
    <View style={{ width: TIME_AXIS_WIDTH }}>
      {Array.from({ length: hoursCount + 1 }, (_, i) => {
        const hour = startHour + i;
        return (
          <View
            key={hour}
            style={{ height: HOUR_HEIGHT, justifyContent: 'flex-start', paddingTop: 2 }}>
            <Text className="pr-2 text-right text-[11px] tabular-nums text-muted-foreground">
              {String(hour).padStart(2, '0')}:00
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function LessonCard({
  position,
  onPress,
}: {
  position: PositionedLesson;
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
        borderLeftWidth: 3,
      }}>
      <View className="px-1.5 py-1">
        <Text className="text-[12px] font-bold leading-tight" style={{ color: color.text }}>
          {lesson.subject}
          {lesson.info ? ` · ${lesson.info}` : ''}
        </Text>
        <Text className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
          {format(lesson.start, 'HH:mm')} – {format(lesson.end, 'HH:mm')}
        </Text>
        {lesson.locations.length > 0 && (
          <Text className="text-[10px] leading-tight text-muted-foreground" numberOfLines={1}>
            {lesson.locations.join(' / ')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function WeekGrid({ days, lessonsForDay, today, onPressLesson }: WeekGridProps) {
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
    const end = Math.min(24, Math.max(DEFAULT_DAY_END, Math.ceil(max / 60) + 1));
    return { dayStart: start, dayEnd: end };
  }, [days, lessonsForDay]);

  const hoursCount = dayEnd - dayStart;
  const dayStartMinutes = dayStart * 60;
  const columnWidthClass =
    Platform.OS === 'web' ? 'flex-1' : 'w-[164px] max-w-[164px] min-w-[164px]';

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
      <View className="flex-row">
        <TimeAxis startHour={dayStart} hoursCount={hoursCount} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className={cn('flex-1', Platform.OS === 'web' && 'flex-none')}
          contentContainerStyle={Platform.OS === 'web' ? { flex: 1 } : undefined}>
          {days.map((day, dayIndex) => {
            const isToday = isSameDay(day, today);
            const positions = layoutDay(lessonsForDay(day), dayStartMinutes);
            const nowLine = isToday
              ? (minutesOfDay(new Date()) - dayStartMinutes) * (HOUR_HEIGHT / 60)
              : null;

            return (
              <View
                key={dayKey(day)}
                className={cn(
                  columnWidthClass,
                  'border-l border-border',
                  dayIndex === 0 && 'border-l-0',
                  isToday && 'bg-primary/[0.04]'
                )}>
                {/* Day header */}
                <View className="border-b border-border px-2 py-2">
                  <Text
                    className={cn(
                      'text-xs font-bold uppercase tracking-wide',
                      isToday ? 'text-primary' : 'text-muted-foreground'
                    )}>
                    {format(day, 'EEEE')}
                  </Text>
                  <Text className={cn('text-xl font-extrabold', isToday ? 'text-primary' : 'text-foreground')}>
                    {format(day, 'd')}
                  </Text>
                </View>

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
                    <LessonCard key={position.lesson.uid} position={position} onPress={onPressLesson} />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </ScrollView>
  );
}