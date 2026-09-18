import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Clock3,
  EyeOff,
  FileDown,
  Info,
  Layers,
  Plus,
  RefreshCw,
  Wrench,
  X,
} from 'lucide-react-native';
import { useCalendar } from '@/context/calendar-context';
import { countHiddenForRule } from '@/lib/hidden';
import { displayBaseUrl } from '@/lib/sync';
import { downloadLessonsCsv } from '@/lib/csv';
import { downloadLessonsIcs } from '@/lib/ics-export';
import type { SyncConfig } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export default function SettingsScreen() {
  const router = useRouter();
  const { data, lessons, syncing, syncNow, unhideRule, resetAll, hiddenRules, removeClass, isHidden } =
    useCalendar();

  const visibleLessons = React.useMemo(
    () => lessons.filter((lesson) => !isHidden(lesson)),
    [lessons, isHidden]
  );

  const confirmRemove = React.useCallback(
    (config: SyncConfig) => {
      const message = `Remove ${config.className} and its lessons from this device?`;
      const run = () => void removeClass(config);
      if (Platform.OS === 'web') {
        if (window.confirm(message)) run();
      } else {
        Alert.alert('Remove class?', message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: run },
        ]);
      }
    },
    [removeClass]
  );

  const exportCsv = React.useCallback(async () => {
    try {
      await downloadLessonsCsv(visibleLessons);
    } catch (error) {
      // Surface export failures (e.g. sharing unavailable) next to the button.
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Could not export.');
    }
  }, [visibleLessons]);

  const exportIcs = React.useCallback(async () => {
    try {
      await downloadLessonsIcs(visibleLessons, 'My timetable');
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Could not export.');
    }
  }, [visibleLessons]);

  const confirmReset = React.useCallback(() => {
    const message = 'This removes your class schedules and all hidden classes from this device.';
    const run = () => {
      void resetAll().then(() => router.replace('/setup'));
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Clear all data?\n\n${message}`)) run();
    } else {
      Alert.alert('Clear all data?', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: run },
      ]);
    }
  }, [resetAll, router]);

  // Hide the "remove" affordance while a sync is in flight to keep the list stable.
  const removable = !syncing;
  // Only clear the status bar on native; web gets no extra top gap.
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <View
        className="flex-row items-center gap-3 px-4 pb-2 pt-3"
        style={{ paddingTop: Math.max(insets.top, 12) }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          className="h-9 w-9 items-center justify-center rounded-md bg-secondary active:bg-accent">
          <ArrowLeft size={17} color="hsl(var(--foreground))" />
        </Pressable>
        <Text className="text-lg font-bold">Settings</Text>
      </View>
      <Separator />

      <FlatList
        className="flex-1"
        data={hiddenRules}
        keyExtractor={(rule) => rule.id}
        contentContainerClassName="p-4 gap-4"
        ListHeaderComponent={
          <View className="gap-4">
            {/* Class list */}
            <View className="rounded-xl border border-border bg-card p-4">
              <View className="flex-row items-center gap-2">
                <View className="h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <Layers size={15} color="hsl(var(--primary))" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold">
                    {data.timetables.length > 0
                      ? `${data.timetables.length} class${data.timetables.length === 1 ? '' : 'es'}`
                      : 'No class synced yet'}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {data.timetables[0]?.config.schoolYear ?? 'Current school year'}
                  </Text>
                </View>
              </View>

              {data.timetables.length > 0 && (
                <View className="mt-3 flex-row items-center justify-between rounded-md bg-secondary px-3 py-2">
                  <View className="flex-row items-center gap-2">
                    <Clock3 size={13} color="hsl(var(--muted-foreground))" />
                    <Text className="text-xs text-muted-foreground">
                      {data.lastSyncedAt
                        ? `Synced ${format(data.lastSyncedAt, 'd MMM yyyy · HH:mm')}`
                        : 'Never synced'}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    {syncing ? (
                      <ActivityIndicator size="small" color="hsl(var(--primary))" />
                    ) : (
                      <Text className="text-xs font-semibold text-muted-foreground">
                        {visibleLessons.length} lessons
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {data.timetables.map((entry) => {
                return (
                  <View
                    key={`${entry.config.baseUrl}-${entry.config.classId}`}
                    className="mt-2 flex-row items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold">{entry.config.className}</Text>
                      <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
                        {entry.lessons.length} lessons
                        {entry.config.schoolYear ? ` · ${entry.config.schoolYear}` : ''} ·{' '}
                        {displayBaseUrl(entry.config.baseUrl)}
                      </Text>
                    </View>
                    {removable && (
                      <Pressable
                        onPress={() => confirmRemove(entry.config)}
                        accessibilityLabel={`Remove ${entry.config.className}`}
                        className="h-8 w-8 items-center justify-center rounded-md bg-secondary active:bg-destructive/20">
                        <X size={14} color="hsl(var(--muted-foreground))" />
                      </Pressable>
                    )}
                  </View>
                );
              })}

              <View className="mt-3 flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={syncing || data.timetables.length === 0}
                  onPress={() => void syncNow()}>
                  {syncing ? (
                    <ActivityIndicator size="small" color="hsl(var(--foreground))" />
                  ) : (
                    <RefreshCw size={14} color="hsl(var(--foreground))" />
                  )}
                  <Text>Sync now</Text>
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onPress={() => router.push('/setup')}>
                  <Plus size={14} color="hsl(var(--foreground))" />
                  <Text>Add class</Text>
                </Button>
              </View>
              <View className="mt-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={visibleLessons.length === 0}
                  onPress={() => void exportIcs()}>
                  <FileDown size={14} color="hsl(var(--muted-foreground))" />
                  <Text>Export timetable (ICS · for calendar apps)</Text>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={visibleLessons.length === 0}
                  onPress={() => void exportCsv()}>
                  <FileDown size={14} color="hsl(var(--muted-foreground))" />
                  <Text>Export timetable (CSV · for spreadsheets)</Text>
                </Button>
              </View>
            </View>

            {/* Info */}
            <View className="flex-row items-start gap-2 rounded-xl border border-border bg-card px-3 py-3">
              <Info size={14} color="hsl(var(--muted-foreground))" className="mt-0.5" />
              <Text className="flex-1 text-xs leading-5 text-muted-foreground">
                Everything is stored on this device. You can use the calendar offline — press
                “Refresh” when you‘re online to pull the latest timetable.
              </Text>
            </View>

            {/* Hidden list header */}
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold">Hidden classes</Text>
              {hiddenRules.length > 0 ? (
                <Text className="text-xs text-muted-foreground">
                  {hiddenRules.length} rule{hiddenRules.length === 1 ? '' : 's'}
                </Text>
              ) : null}
            </View>
            {hiddenRules.length === 0 ? (
              <View className="items-center gap-2 rounded-xl border border-dashed border-border py-8">
                <EyeOff size={20} color="hsl(var(--muted-foreground))" />
                <Text className="text-xs text-muted-foreground">
                  Nothing hidden yet. Open a class on the calendar and press “Hide this class”.
                </Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void unhideRule(item.id)}
            className="flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3 active:bg-accent">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold">{item.label}</Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                {countHiddenForRule(item, lessons)} lesson
                {countHiddenForRule(item, lessons) === 1 ? '' : 's'} across weeks
              </Text>
            </View>
            <Switch
              checked
              onCheckedChange={() => void unhideRule(item.id)}
              accessibilityLabel={`Unhide ${item.label}`}
            />
          </Pressable>
        )}
        ListEmptyComponent={null}
        ListFooterComponent={
          <View className="mt-2">
            <Separator className="mb-4" />
            <Button variant="destructive" size="sm" onPress={confirmReset}>
              <Wrench size={14} color="hsl(var(--destructive-foreground))" />
              <Text>Clear all data</Text>
            </Button>
            <Text className="mt-4 text-center text-xs text-muted-foreground">
              Actually Usable Calendar · powered by WebUntis
            </Text>
          </View>
        }
      />
    </View>
  );
}