import { format, isSameDay, isSameMonth } from 'date-fns';
import { Pressable, SectionList, View } from 'react-native';
import { lightSubjectColor, subjectColor } from '@/lib/colors';
import { useTheme } from '@/context/theme-context';
import type { Lesson } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

interface WeekAgendaProps {
  days: Date[];
  lessonsForDay: (day: Date) => Lesson[];
  today: Date;
  onPressLesson: (lesson: Lesson) => void;
}

export function WeekAgenda({ days, lessonsForDay, today, onPressLesson }: WeekAgendaProps) {
  const sections = days.map((day) => {
    const lessons = lessonsForDay(day);
    return {
      day,
      title: isSameDay(day, today) ? 'Today' : format(day, 'EEEE'),
      data: lessons,
    };
  });

  return (
    <SectionList
      className="flex-1"
      sections={sections}
      keyExtractor={(lesson) => lesson.uid}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => {
        const { day } = section;
        const isToday = isSameDay(day, today);
        return (
          <View
            className={cn(
              'flex-row items-baseline justify-between border-b border-border bg-background px-4 py-2',
              isToday && 'bg-primary/[0.06]'
            )}>
            <Text className={cn('text-sm font-bold', isToday && 'text-primary')}>{section.title}</Text>
            <Text className="text-xs text-muted-foreground">
              {format(day, 'd MMM')}
              {!isSameMonth(day, today) ? ` · ${format(day, 'yyyy')}` : ''}
            </Text>
          </View>
        );
      }}
      renderSectionFooter={() => <View className="h-1" />}
      renderItem={({ item, section }) => (
        <LessonRow lesson={item} day={section.day} onPress={onPressLesson} />
      )}
      ListEmptyComponent={
        <View className="px-4 py-12 items-center">
          <Text className="text-sm text-muted-foreground">No classes this week.</Text>
        </View>
      }
    />
  );
}

function LessonRow({
  lesson,
  day,
  onPress,
}: {
  lesson: Lesson;
  day: Date;
  onPress: (lesson: Lesson) => void;
}) {
  const { isDark } = useTheme();
  const color = isDark
    ? subjectColor(lesson.subject, lesson.color)
    : lightSubjectColor(lesson.subject, lesson.color);
  const weekend = day.getDay() === 0 || day.getDay() === 6;

  return (
    <Pressable
      onPress={() => onPress(lesson)}
      className="flex-row items-stretch px-4 py-2.5 active:bg-accent/50">
      <View
        className="mr-3 w-[52px] items-center justify-center rounded-md py-1.5"
        style={{ backgroundColor: color.bg }}>
        <Text className="text-[11px] font-bold tabular-nums" style={{ color: color.text }}>
          {format(lesson.start, 'HH:mm')}
        </Text>
        <Text className="text-[9px] tabular-nums text-muted-foreground">
          {format(lesson.end, 'HH:mm')}
        </Text>
      </View>
      <View className="flex-1 border-b border-border py-1">
        <View className="flex-row items-center">
          <View className="h-3 w-1 rounded-full" style={{ backgroundColor: color.accent }} />
          <Text className="ml-2 text-sm font-semibold" style={{ color: color.text }} numberOfLines={1}>
            {lesson.subject}
            {lesson.info ? ` · ${lesson.info}` : ''}
          </Text>
        </View>
        <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
          {[lesson.locations.join(' / '), lesson.teachers.join(', ')].filter(Boolean).join(' · ')}
        </Text>
        {weekend && (
          <Text className="mt-0.5 text-[10px] italic text-muted-foreground">Weekend · makeup lesson</Text>
        )}
      </View>
    </Pressable>
  );
}