import { differenceInMinutes, format } from 'date-fns';
import { Pressable, View } from 'react-native';
import { Icon as ChevronRight, Icon as Play } from '@/components/ui/icon';
import { lightSubjectColor, subjectColor } from '@/lib/colors';
import { useTheme } from '@/context/theme-context';
import type { Lesson } from '@/lib/types';
import { Text } from '@/components/ui/text';

interface NowBannerProps {
  lessons: Lesson[];
  now: Date;
  onPressLesson: (lesson: Lesson) => void;
}

/**
 * "Now & next" strip shown under the toolbar: the lesson in progress (if
 * any) and the next one starting today. Hidden when nothing is happening
 * today, so evenings/weekends stay clean.
 */
export function NowBanner({ lessons, now, onPressLesson }: NowBannerProps) {
  const { isDark } = useTheme();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayEnd = dayStart + 86_400_000;
  const nowMs = now.getTime();

  const todays = lessons
    .filter((lesson) => lesson.start >= dayStart && lesson.start < dayEnd)
    .sort((a, b) => a.start - b.start);

  const current = todays.find((lesson) => lesson.start <= nowMs && lesson.end > nowMs);
  const upcoming = todays.find((lesson) => lesson.start > nowMs);

  if (!current && !upcoming) return null;

  // Custom colors picked at creation win over the hashed subject palette.
  const subjectColorFor = (subject: string, customHex?: string) =>
    isDark
      ? subjectColor(subject, customHex)
      : lightSubjectColor(subject, customHex);

  return (
    <View className="mx-4 mb-2 flex-row gap-2">
      {current ? (
        <Pressable
          onPress={() => onPressLesson(current)}
          className="flex-1 flex-row items-center gap-2 rounded-lg border px-3 py-2 active:opacity-80"
          style={{
            backgroundColor: subjectColorFor(current.subject, current.color).bg,
            borderColor: subjectColorFor(current.subject, current.color).accent,
          }}
          accessibilityLabel={`Now: ${current.subject}`}>
          <View
            className="h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: subjectColorFor(current.subject, current.color).accent }}>
            <Play size={13} color="hsl(var(--background))" as="play" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Now · {differenceInMinutes(nowMs, current.start)}m left
            </Text>
            <Text
              className="text-sm font-bold"
              style={{ color: subjectColorFor(current.subject, current.color).text }}
              numberOfLines={1}>
              {current.subject}
            </Text>
            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
              {format(current.start, 'HH:mm')}–{format(current.end, 'HH:mm')}
              {current.locations.length > 0 ? ` · ${current.locations.join(' / ')}` : ''}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {upcoming ? (
        <Pressable
          onPress={() => onPressLesson(upcoming)}
          className={
            current
              ? 'w-[38%] flex-row items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 active:opacity-80'
              : 'flex-1 flex-row items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 active:opacity-80'
          }
          accessibilityLabel={`Next: ${upcoming.subject}`}>
          <View className="min-w-0 flex-1">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Next · {format(upcoming.start, 'HH:mm')}
            </Text>
            <Text
              className="text-sm font-bold"
              style={{ color: subjectColorFor(upcoming.subject, upcoming.color).text }}
              numberOfLines={1}>
              {upcoming.subject}
            </Text>
            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
              {upcoming.locations.length > 0 ? upcoming.locations.join(' / ') : 'No room'}
            </Text>
          </View>
          <ChevronRight size={14} color="hsl(var(--muted-foreground))" as="chevron-right" />
        </Pressable>
      ) : null}
    </View>
  );
}
