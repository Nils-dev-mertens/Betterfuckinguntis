import { format } from 'date-fns';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, View } from 'react-native';
import { ArrowLeft, Check, Clock3, EyeOff, Info, Layers, Link2, Wrench } from 'lucide-react-native';
import { useCalendar } from '@/context/calendar-context';
import { countHiddenForRule } from '@/lib/hidden';
import { normalizeBaseUrl } from '@/lib/sync';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export default function SettingsScreen() {
  const router = useRouter();
  const { data, syncing, syncNow, unhideRule, resetAll, hiddenRules } = useCalendar();
  const [copied, setCopied] = React.useState(false);

  const syncUrl = React.useMemo(() => {
    if (!data.config) return null;
    const params = new URLSearchParams({ class: String(data.config.classId) });
    if (data.config.dateRange) {
      params.set('start', data.config.dateRange.start);
      params.set('end', data.config.dateRange.end);
    }
    return `${normalizeBaseUrl(data.config.baseUrl)}/calendar?${params.toString()}`;
  }, [data.config]);

  const copySyncUrl = React.useCallback(async () => {
    if (!syncUrl) return;
    await Clipboard.setStringAsync(syncUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [syncUrl]);

  const confirmReset = React.useCallback(() => {
    const message = 'This removes your class schedule and all hidden classes from this device.';
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

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-14">
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
            {/* Class card */}
            <View className="rounded-xl border border-border bg-card p-4">
              <View className="flex-row items-center gap-2">
                <View className="h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <Layers size={15} color="hsl(var(--primary))" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold">{data.config?.className ?? 'No class selected'}</Text>
                  <Text className="text-xs text-muted-foreground">
                    {data.config?.schoolYear ?? 'Current school year'} · {data.config?.baseUrl}
                  </Text>
                </View>
              </View>

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
                      {data.lessons.length} classes
                    </Text>
                  )}
                </View>
              </View>

              <View className="mt-3 flex-row gap-2">
                <Button variant="outline" size="sm" className="flex-1" disabled={syncing} onPress={() => void syncNow()}>
                  <Text>Sync now</Text>
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onPress={() => router.push('/setup')}>
                  <Text>Change class</Text>
                </Button>
              </View>
              <View className="mt-2">
                <Button variant="secondary" size="sm" disabled={!syncUrl || syncing} onPress={copySyncUrl}>
                  {copied ? (
                    <Check size={14} color="hsl(var(--muted-foreground))" />
                  ) : (
                    <Link2 size={14} color="hsl(var(--muted-foreground))" />
                  )}
                  <Text>{copied ? 'Copied!' : 'Copy sync URL (for other calendar apps)'}</Text>
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
                {countHiddenForRule(item, data.lessons)} lesson
                {countHiddenForRule(item, data.lessons) === 1 ? '' : 's'} across weeks
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
              Actually Usable Calendar · powered by AP-WebUntisToICS
            </Text>
          </View>
        }
      />
    </View>
  );
}