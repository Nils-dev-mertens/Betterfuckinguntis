import { differenceInMinutes, format } from 'date-fns';
import { Pressable, View } from 'react-native';
import { ChevronRight, Play } from 'lucide-react-native';
import { subjectColor } from '@/lib/colors';
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
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayEnd = dayStart + 86_400_000;
  const nowMs = now.getTime();

  const todays = lessons
    .filter((lesson) => lesson.start >= dayStart && lesson.start < dayEnd)
    .sort((a, b) => a.start - b.start);

  const current = todays.find((lesson) => lesson.start <= nowMs && lesson.end > nowMs);
  const upcoming = todays.find((lesson) => lesson.start > nowMs);

  if (!current && !upcoming) return null;

  return (
    <View className="mx-4 mb-2 flex-row gap-2">
      {current ? (
        <Pressable
          onPress={() => onPressLesson(current)}
          className="flex-1 flex-row items-center gap-2 rounded-lg border px-3 py-2 active:opacity-80"
          style={{
            backgroundColor: subjectColor(current.subject).bg,
            borderColor: subjectColor(current.subject).accent,
          }}
          accessibilityLabel={`Now: ${current.subject}`}>
          <View className="h-7 w-7 items-center justify-center rounded-full">
            <Play size={14} fill={subjectColor(current.subject).accent} color={subjectColor(current.subject).accent} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Now · {differenceInMinutes(nowMs, current.start)}m left
            </Text>
            <Text
              className="text-sm font-bold"
              style={{ color: subjectColor(current.subject).text }}
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
              style={{ color: subjectColor(upcoming.subject).text }}
              numberOfLines={1}>
              {upcoming.subject}
            </Text>
            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
              {upcoming.locations.length > 0 ? upcoming.locations.join(' / ') : 'No room'}
            </Text>
          </View>
          <ChevronRight size={14} color="hsl(var(--muted-foreground))" />
        </Pressable>
      ) : null}
    </View>
  );
}
