import { format } from 'date-fns';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Icon as ArrowLeft,
  Icon as Bell,
  Icon as Download,
  Icon as EyeOff,
  Icon as Plus,
  Icon as RefreshCw,
  Icon as Trash2,
} from '@/components/ui/icon';
import { useCalendar } from '@/context/calendar-context';
import { useTheme } from '@/context/theme-context';
import {
  REMINDER_LEAD_CHOICES,
  getPermissionStatus,
  notificationsSupported,
  requestPermission,
} from '@/lib/notifications';
import { ACCENTS, THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';
import { countHiddenForRule } from '@/lib/hidden';
import { displayBaseUrl } from '@/lib/sync';
import { downloadLessonsCsv } from '@/lib/csv';
import { downloadLessonsIcs } from '@/lib/ics-export';
import { checkForUpdate, updatesSupported } from '@/lib/updates';
import type { SyncConfig } from '@/lib/types';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

/* ------------------------------------------------------------------ */
/* Small building blocks: a section is a title + one plain card; a row  */
/* is one action. No nested boxes, no icon tiles — just clean rows.     */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      <View className="overflow-hidden rounded-xl border border-border bg-card">{children}</View>
    </View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  danger,
  disabled,
  onPress,
  right,
  last,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  danger?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      className={cn(
        'flex-row items-center gap-3 px-4 py-3',
        !last && 'border-b border-border',
        onPress && !disabled && 'active:bg-accent/60',
        disabled && 'opacity-50'
      )}>
      {icon ? <IconGlyph name={icon} danger={danger} /> : null}
      <View className="flex-1">
        <Text className={cn('text-sm font-medium', danger && 'text-destructive')}>{title}</Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs leading-4 text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

/** Small plain glyph in front of a row — muted, no colored tile. */
function IconGlyph({ name, danger }: { name: string; danger?: boolean }) {
  const color = danger ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))';
  return (
    <View className="w-6 items-center">
      {name === 'refresh' ? (
        <RefreshCw size={15} color={color} as="refresh-cw" />
      ) : name === 'plus' ? (
        <Plus size={15} color={color} as="plus" />
      ) : name === 'download' ? (
        <Download size={15} color={color} as="download" />
      ) : name === 'bell' ? (
        <Bell size={15} color={color} as="bell" />
      ) : name === 'eye-off' ? (
        <EyeOff size={15} color={color} as="eye-off" />
      ) : null}
    </View>
  );
}

function SectionCaption({ children }: { children: React.ReactNode }) {
  return <Text className="mt-1.5 px-1 text-xs leading-4 text-muted-foreground">{children}</Text>;
}

/* ------------------------------------------------------------------ */

export default function SettingsScreen() {
  const router = useRouter();
  const {
    data,
    lessons,
    syncing,
    syncNow,
    unhideRule,
    resetAll,
    hiddenRules,
    removeClass,
    isHidden,
    updateReminders,
  } = useCalendar();
  const { themeId, accentId, setTheme, setAccent } = useTheme();

  const [reminderPermission, setReminderPermission] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (notificationsSupported()) void getPermissionStatus().then(setReminderPermission);
  }, []);

  const toggleReminders = React.useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const status = await requestPermission();
        setReminderPermission(status);
        // Don't flip the switch on if the OS refused.
        if (status !== 'granted') return;
      }
      await updateReminders({ enabled });
    },
    [updateReminders]
  );

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

  const [checkingUpdate, setCheckingUpdate] = React.useState(false);
  const [updateMessage, setUpdateMessage] = React.useState<string | null>(null);

  const runUpdateCheck = React.useCallback(async () => {
    setCheckingUpdate(true);
    setUpdateMessage(null);
    const result = await checkForUpdate();
    setUpdateMessage(result.message);
    setCheckingUpdate(false);
  }, []);

  // Only clear the status bar on native; web gets no extra top gap.
  const insets = useSafeAreaInsets();
  const canExport = visibleLessons.length > 0;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center gap-3 px-4 pb-2 pt-3"
        style={{ paddingTop: Math.max(insets.top, 12) }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          className="h-9 w-9 items-center justify-center rounded-md bg-secondary active:bg-accent">
          <ArrowLeft size={17} color="hsl(var(--foreground))" as="arrow-left" />
        </Pressable>
        <Text className="text-lg font-bold">Settings</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 24 }}>
        {/* Classes */}
        <Section title="Classes">
          {data.timetables.length === 0 ? (
            <Row
              title="No class yet"
              subtitle="Add your first class to get started"
              onPress={() => router.push('/setup')}
              last
            />
          ) : (
            data.timetables.map((entry, index) => (
              <Row
                key={`${entry.config.baseUrl}-${entry.config.classId}`}
                title={entry.config.className}
                subtitle={`${entry.lessons.length} lessons${
                  entry.config.schoolYear ? ` · ${entry.config.schoolYear}` : ''
                } · ${displayBaseUrl(entry.config.baseUrl)}`}
                right={
                  syncing ? null : (
                    <Pressable
                      onPress={() => confirmRemove(entry.config)}
                      accessibilityLabel={`Remove ${entry.config.className}`}
                      className="h-8 w-8 items-center justify-center rounded-md active:bg-destructive/20">
                      <Text className="text-lg leading-6 text-muted-foreground">×</Text>
                    </Pressable>
                  )
                }
                last={index === data.timetables.length - 1}
              />
            ))
          )}
          <Row
            icon="refresh"
            title={syncing ? 'Syncing…' : 'Sync now'}
            subtitle={
              data.lastSyncedAt ? `Last synced ${format(data.lastSyncedAt, 'd MMM · HH:mm')}` : 'Never synced'
            }
            disabled={syncing || data.timetables.length === 0}
            onPress={() => void syncNow()}
            last
          />
          <Row icon="plus" title="Add class" onPress={() => router.push('/setup')} last />
        </Section>

        {/* Export */}
        <View>
          <Section title="Export">
            <Row
              icon="download"
              title="Calendar file (ICS)"
              subtitle="For Google Calendar, ICSx⁵, …"
              disabled={!canExport}
              onPress={() => void exportIcs()}
            />
            <Row
              icon="download"
              title="Spreadsheet (CSV)"
              subtitle="For Excel, Sheets, …"
              disabled={!canExport}
              onPress={() => void exportCsv()}
              last
            />
          </Section>
          {!canExport ? (
            <SectionCaption>Add a class first to export your timetable.</SectionCaption>
          ) : null}
        </View>

        {/* Appearance */}
        <Section title="Appearance">
          <View className="border-b border-border px-4 py-3">
            <Text className="text-sm font-medium">Theme</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {THEMES.map((theme) => (
                <Pressable
                  key={theme.id}
                  onPress={() => setTheme(theme.id)}
                  accessibilityLabel={`Theme ${theme.name}`}
                  className={cn(
                    'flex-row items-center gap-2 rounded-lg border px-3 py-1.5',
                    themeId === theme.id ? 'border-primary bg-primary/10' : 'border-border bg-secondary/40'
                  )}>
                  <View
                    className="h-3 w-3 rounded-full border border-border"
                    style={{ backgroundColor: `hsl(${theme.palette.background})` }}
                  />
                  <Text
                    className={cn(
                      'text-xs font-semibold',
                      themeId === theme.id ? 'text-primary' : 'text-foreground'
                    )}>
                    {theme.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View className="px-4 py-3">
            <Text className="text-sm font-medium">Accent color</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {ACCENTS.map((accent) => (
                <Pressable
                  key={accent.id}
                  onPress={() => setAccent(accent.id)}
                  accessibilityLabel={`Accent ${accent.name}`}
                  className={cn(
                    'h-8 w-8 items-center justify-center rounded-full border-2',
                    accentId === accent.id ? 'border-primary' : 'border-transparent'
                  )}>
                  <View
                    className="h-5 w-5 rounded-full"
                    style={{
                      backgroundColor: accent.id === 'none' ? 'hsl(var(--border))' : `hsl(${accent.hsl})`,
                    }}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </Section>

        {/* Reminders */}
        <View>
          <Section title="Reminders">
            <Row
              icon="bell"
              title="Before a lesson starts"
              subtitle={
                notificationsSupported()
                  ? reminderPermission === 'denied'
                    ? 'Blocked in system settings — enable them there'
                    : 'Get a notification before class'
                  : 'Only available in the mobile app'
              }
              right={
                <Switch
                  checked={notificationsSupported() && data.reminders.enabled}
                  disabled={!notificationsSupported()}
                  onCheckedChange={(checked) => void toggleReminders(checked)}
                  accessibilityLabel="Enable lesson reminders"
                />
              }
              last={!(notificationsSupported() && data.reminders.enabled)}
            />
            {notificationsSupported() && data.reminders.enabled ? (
              <View className="flex-row items-center gap-2 px-4 py-3">
                {REMINDER_LEAD_CHOICES.map((lead) => (
                  <Pressable
                    key={lead}
                    onPress={() => void updateReminders({ leadMinutes: lead })}
                    accessibilityLabel={`Remind ${lead} minutes before`}
                    className={cn(
                      'rounded-lg border px-3 py-1.5',
                      data.reminders.leadMinutes === lead
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-secondary/40'
                    )}>
                    <Text
                      className={cn(
                        'text-xs font-semibold',
                        data.reminders.leadMinutes === lead ? 'text-primary' : 'text-foreground'
                      )}>
                      {lead} min
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Section>
        </View>

        {/* Hidden classes */}
        <Section title={`Hidden classes${hiddenRules.length > 0 ? ` (${hiddenRules.length})` : ''}`}>
          {hiddenRules.length === 0 ? (
            <Row
              icon="eye-off"
              title="Nothing hidden"
              subtitle="Open a lesson on the calendar and choose “Hide this class”"
              last
            />
          ) : (
            hiddenRules.map((rule, index) => (
              <Row
                key={rule.id}
                icon="eye-off"
                title={rule.label}
                subtitle={`${countHiddenForRule(rule, lessons)} lesson${
                  countHiddenForRule(rule, lessons) === 1 ? '' : 's'
                } across weeks`}
                right={
                  <Switch
                    checked
                    onCheckedChange={() => void unhideRule(rule.id)}
                    accessibilityLabel={`Unhide ${rule.label}`}
                  />
                }
                last={index === hiddenRules.length - 1}
              />
            ))
          )}
        </Section>

        {/* App */}
        {updatesSupported() ? (
          <Section title="App">
            <Row
              icon="refresh"
              title="Check for updates"
              subtitle={updateMessage ?? undefined}
              disabled={checkingUpdate}
              onPress={() => void runUpdateCheck()}
              last
            />
          </Section>
        ) : null}
        {/* Destructive action gets a solid red button, not a red-text row. */}
        <Button variant="destructive" size="lg" onPress={confirmReset}>
          <Trash2 size={15} color="hsl(var(--destructive-foreground))" as="trash-2" />
          <Text>Clear all data</Text>
        </Button>
        <SectionCaption>
          Everything is stored on this device and works offline. Press “Sync now” when you're online
          to pull the latest timetable.
        </SectionCaption>

        <Text className="pb-2 text-center text-xs text-muted-foreground">
          Actually Usable Calendar v{Constants.expoConfig?.version ?? '?'} · powered by WebUntis
        </Text>
      </ScrollView>
    </View>
  );
}
