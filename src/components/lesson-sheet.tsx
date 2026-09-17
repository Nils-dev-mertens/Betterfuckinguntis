import { format } from 'date-fns';
import { Modal, Pressable, View } from 'react-native';
import { useCalendar } from '@/context/calendar-context';
import { lessonDayOfWeek, lessonMinutes, ruleFromLesson } from '@/lib/hidden';
import { subjectColor } from '@/lib/colors';
import type { Lesson } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';

interface LessonSheetProps {
  lesson: Lesson | null;
  onClose: () => void;
}

export function LessonSheet({ lesson, onClose }: LessonSheetProps) {
  const { isHidden, hideLesson, unhideRule } = useCalendar();

  if (!lesson) return null;
  const hidden = isHidden(lesson);
  const rule = ruleFromLesson(lesson);
  const color = subjectColor(lesson.subject);
  const { start } = lessonMinutes(lesson);
  const hh = String(Math.floor(start / 60)).padStart(2, '0');
  const mm = String(start % 60).padStart(2, '0');

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View className="flex-1 justify-end web:justify-center web:items-center">
        <Pressable className="absolute inset-0 bg-black/70" onPress={onClose} />
        <Card
          className="w-full rounded-b-none rounded-t-2xl border-x-0 border-b-0 web:max-w-md web:rounded-2xl web:border"
          style={{ backgroundColor: 'hsl(var(--card))' }}>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <View className="h-6 w-2 rounded-full" style={{ backgroundColor: color.accent }} />
              <CardTitle className="flex-1">
                <Text className="text-lg font-bold" style={{ color: color.text }}>
                  {lesson.subject}
                </Text>
              </CardTitle>
            </View>
            <View className="pl-4">
              <Text className="text-sm font-medium">
                {format(lesson.start, 'EEEE d MMMM')} · {format(lesson.start, 'HH:mm')} –{' '}
                {format(lesson.end, 'HH:mm')}
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Slot: {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][lessonDayOfWeek(lesson)]}{' '}
                {hh}:{mm}
              </Text>
            </View>
          </CardHeader>

          <CardContent className="gap-3">
            {lesson.info ? (
              <DetailRow label="Note" value={lesson.info} />
            ) : null}
            {lesson.locations.length > 0 ? (
              <DetailRow label="Rooms" value={lesson.locations.join(' / ')} />
            ) : null}
            {lesson.teachers.length > 0 ? (
              <DetailRow label="Teachers" value={lesson.teachers.join(', ')} />
            ) : null}
            {lesson.classes.length > 0 ? (
              <DetailRow label="Classes" value={lesson.classes.join(' / ')} />
            ) : null}

            <Separator className="my-1" />

            {hidden ? (
              <View className="gap-2">
                <Text className="text-center text-sm font-semibold text-primary">
                  This class (every week) is hidden.
                </Text>
                <Button variant="outline" size="sm" onPress={() => unhideRule(rule.id)}>
                  <Text>Show again in all weeks</Text>
                </Button>
              </View>
            ) : (
              <Button variant="destructive" size="sm" onPress={() => hideLesson(lesson)}>
                <Text>Hide this class in all weeks</Text>
              </Button>
            )}
            <Text className="text-center text-xs text-muted-foreground">
              {hidden
                ? 'This hides the matching recurring slot only in this calendar. It will stay hidden for future weeks.'
                : 'Hides every matching recurring weekly slot — now and in future weeks. Manage from Settings.'}
            </Text>
          </CardContent>
        </Card>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row">
      <Text className="w-20 text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-sm font-medium">{value}</Text>
    </View>
  );
}