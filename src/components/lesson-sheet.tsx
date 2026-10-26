import { format } from 'date-fns';
import * as React from 'react';
import { Alert, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '@/components/ui/backdrop';
import { useCalendar } from '@/context/calendar-context';
import { SLOT_DAY_NAMES, lessonDayOfWeek, lessonMinutes, ruleScopeText } from '@/lib/hidden';
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
  const {
    isHidden,
    hiddenRuleFor,
    hideLesson,
    hideLessonForWeeks,
    unhideRule,
    removeLesson,
    removeLessonOccurrence,
  } = useCalendar();
  // Modals render outside the themed root view, so the CSS variables must
  // be re-declared here for the picked theme/accent to apply inside.
  const { style: themeStyle, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  /** How many weekly occurrences a scoped hide covers; 1 = this week only. */
  const [hideWeeks, setHideWeeks] = React.useState(1);
  // Opening another lesson starts from "this week only" again.
  React.useEffect(() => setHideWeeks(1), [lesson?.uid]);

  // All hooks run above this line: an early return before a hook changes the
  // hook count between renders, which React rejects.
  if (!lesson) return null;
  const hidden = isHidden(lesson);
  // The rule that actually hides it — unhiding it must not depend on a rule
  // rebuilt from this lesson, which can carry other teachers/time data.
  const hiddenRule = hiddenRuleFor(lesson);
  const scopedHide = (hiddenRule?.dates?.length ?? 0) > 0;
  const color = isDark
    ? subjectColor(lesson.subject, lesson.color)
    : lightSubjectColor(lesson.subject, lesson.color);
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
      // Edge-to-edge Android: without this the scrim stops above the
      // navigation bar, leaving an undimmed strip at the bottom.
      navigationBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}>
      <View
        className="flex-1 justify-end web:justify-center web:items-center"
        style={themeStyle}>
        {/** theme vars re-declared so the sheet follows the picked theme */}
        <Backdrop onPress={onClose} />
        <Card
          // Background comes from Card's own `bg-card` class. An inline
          // `hsl(var(--card))` would bypass NativeWind, which is what
          // resolves the CSS variable on native — React Native's colour
          // parser cannot read `var()`, so the sheet rendered transparent.
          className="w-full rounded-b-none rounded-t-2xl border-x-0 border-b-0 web:max-w-md web:rounded-2xl web:border"
          // The modal draws behind the Android navigation bar; keep the
          // buttons clear of it.
          style={{ paddingBottom: insets.bottom }}>
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
                Slot: {SLOT_DAY_NAMES[lessonDayOfWeek(lesson)]}{' '}
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
            ) : hidden && hiddenRule ? (
              <View className="gap-2">
                <Text className="text-center text-sm font-semibold text-primary">
                  {scopedHide
                    ? `Hidden for ${ruleScopeText(hiddenRule)}.`
                    : 'This class (every week) is hidden.'}
                </Text>
                <Button variant="outline" size="sm" onPress={() => void unhideRule(hiddenRule.id)}>
                  <Text>{scopedHide ? 'Show again' : 'Show again in all weeks'}</Text>
                </Button>
              </View>
            ) : (
              <View className="gap-2">
                <Button variant="destructive" size="sm" onPress={() => void hideLesson(lesson)}>
                  <Text>Hide every week</Text>
                </Button>
                {/* Scope picker: limit the hide to the next few weeks of the slot */}
                <View className="flex-row items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
                  <Text className="text-xs font-medium text-muted-foreground">Hide for</Text>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => setHideWeeks((current) => Math.max(1, current - 1))}
                      accessibilityLabel="Fewer weeks"
                      className="h-7 w-7 items-center justify-center rounded-md bg-secondary active:bg-accent">
                      <Text className="text-base font-bold text-secondary-foreground">−</Text>
                    </Pressable>
                    <Text className="w-16 text-center text-sm font-semibold tabular-nums">
                      {hideWeeks} {hideWeeks === 1 ? 'week' : 'weeks'}
                    </Text>
                    <Pressable
                      onPress={() => setHideWeeks((current) => Math.min(12, current + 1))}
                      accessibilityLabel="More weeks"
                      className="h-7 w-7 items-center justify-center rounded-md bg-secondary active:bg-accent">
                      <Text className="text-base font-bold text-secondary-foreground">+</Text>
                    </Pressable>
                  </View>
                </View>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => void hideLessonForWeeks(lesson, hideWeeks)}>
                  <Text>{hideWeeks === 1 ? 'Hide for 1 week' : `Hide for ${hideWeeks} weeks`}</Text>
                </Button>
              </View>
            )}
            {!isManual ? (
              <Text className="text-center text-xs text-muted-foreground">
                {hidden
                  ? 'Hiding applies to this weekly slot. Everything hidden is listed in Settings.'
                  : '“Hide every week” hides the slot in all weeks; the counter hides only the next few. Manage from Settings.'}
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