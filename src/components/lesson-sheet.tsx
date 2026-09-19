import { format } from 'date-fns';
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useCalendar } from '@/context/calendar-context';
import { lessonDayOfWeek, lessonMinutes, ruleFromLesson } from '@/lib/hidden';
import { lightSubjectColor, subjectColor } from '@/lib/colors';
import { useTheme } from '@/context/theme-context';
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
  const { isHidden, hideLesson, unhideRule, removeLesson, removeLessonOccurrence } = useCalendar();

  if (!lesson) return null;
  const hidden = isHidden(lesson);
  const rule = ruleFromLesson(lesson);
  const { isDark } = useTheme();
  const color = isDark ? subjectColor(lesson.subject) : lightSubjectColor(lesson.subject);
  const { start } = lessonMinutes(lesson);
  const hh = String(Math.floor(start / 60)).padStart(2, '0');
  const mm = String(start % 60).padStart(2, '0');
  // Manual lessons can be deleted; synced ones can only be hidden.
  const isManual = Boolean(lesson.manual);
  const isSeriesBase = Boolean(lesson.manual && lesson.repeat === 'weekly');
  const isRepeatedOccurrence = Boolean(lesson.uid.includes('#'));

  const confirmDeleteSeries = () => {
    const message = `Delete "${lesson.subject}" and all its future weekly repeats?`;
    const run = () => {
      void removeLesson(lesson.uid.split('#')[0]);
      onClose();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(message)) run();
    } else {
      Alert.alert('Delete series?', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: run },
      ]);
    }
  };

  const confirmDeleteOccurrence = () => {
    const message =
      'This removes the series from this week onward. Earlier weeks stay as they are.';
    const run = () => {
      void removeLessonOccurrence(lesson);
      onClose();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(message)) run();
    } else {
      Alert.alert('Delete from here on?', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: run },
      ]);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}>
      <View className="flex-1 justify-end web:justify-center web:items-center">
        <Pressable
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
          onPress={onClose}
        />
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

            {isManual ? (
              <>
                <Text className="text-center text-xs text-muted-foreground">
                  You created this lesson, so you can delete it. Synced classes are hidden instead
                  of deleted.
                </Text>
                {isSeriesBase ? (
                  <View className="gap-2">
                    {isRepeatedOccurrence ? (
                      <Button variant="outline" size="sm" onPress={confirmDeleteOccurrence}>
                        <Text>Delete this and future repeats</Text>
                      </Button>
                    ) : null}
                    <Button variant="destructive" size="sm" onPress={confirmDeleteSeries}>
                      <Text>Delete series</Text>
                    </Button>
                  </View>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onPress={() => {
                      void removeLesson(lesson.uid);
                      onClose();
                    }}>
                    <Text>Delete lesson</Text>
                  </Button>
                )}
              </>
            ) : hidden ? (
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
            {!isManual ? (
              <Text className="text-center text-xs text-muted-foreground">
                {hidden
                  ? 'This hides the matching recurring slot only in this calendar. It will stay hidden for future weeks.'
                  : 'Hides every matching recurring weekly slot — now and in future weeks. Manage from Settings.'}
              </Text>
            ) : null}
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