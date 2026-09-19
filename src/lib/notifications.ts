/**
 * Local lesson reminders. The timetable is already stored on-device, so
 * reminders are scheduled locally with expo-notifications — no push server,
 * no tokens, works fully offline. Scheduling is idempotent: every change
 * cancels the previous set first.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Lesson } from '@/lib/types';

export const REMINDER_LEAD_CHOICES = [5, 10, 15] as const;
export type ReminderLead = (typeof REMINDER_LEAD_CHOICES)[number];

const CHANNEL_ID = 'reminders';
/** Android caps pending scheduled notifications; 48 upcoming lessons is plenty. */
const MAX_SCHEDULED = 48;

export function notificationsSupported(): boolean {
  return Platform.OS !== 'web';
}

/** Show alerts while the app is foregrounded (native behavior otherwise). */
export function configureHandler() {
  if (!notificationsSupported()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Lesson reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#7C5CFF',
  });
}

export async function getPermissionStatus(): Promise<Notifications.PermissionStatus> {
  if (!notificationsSupported()) return Notifications.PermissionStatus.UNDETERMINED;
  return (await Notifications.getPermissionsAsync()).status;
}

/** Ask the OS for notification permission (Android 13+ prompt / iOS prompt). */
export async function requestPermission(): Promise<Notifications.PermissionStatus> {
  if (!notificationsSupported()) return Notifications.PermissionStatus.UNDETERMINED;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === Notifications.PermissionStatus.GRANTED) return current.status;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status;
}

/** One weekly calendar trigger: same weekday + time every week. */
interface WeeklySlot {
  dayOfWeek: number; // 1 (Sunday) … 7 (Saturday), per expo-calendar-trigger
  hour: number;
  minute: number;
}

function toWeeklySlot(startMs: number): WeeklySlot {
  const date = new Date(startMs);
  // JS getDay(): 0 (Sun) … 6 (Sat) → expo: 1 (Sun) … 7 (Sat)
  return {
    dayOfWeek: date.getDay() + 1,
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

/**
 * Schedules weekly reminders for the upcoming lessons (deduplicated per
 * weekday/time), each firing `leadMinutes` before the lesson starts.
 * Returns the number of scheduled reminders.
 */
export async function scheduleLessonReminders(
  lessons: Lesson[],
  leadMinutes: ReminderLead
): Promise<number> {
  if (!notificationsSupported()) return 0;
  await ensureChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Deduplicate: a weekly slot only needs one calendar trigger, even if ten
  // lessons share the same weekday+time across synced classes. The trigger
  // fires `leadMinutes` before the lesson starts.
  const slots = new Map<string, { slot: WeeklySlot; sample: Lesson }>();
  for (const lesson of lessons) {
    const slot = toWeeklySlot(lesson.start - leadMinutes * 60_000);
    const key = keyOf(slot);
    if (!slots.has(key)) slots.set(key, { slot, sample: lesson });
  }

  const upcoming = [...slots.values()]
    .sort((a, b) => {
      const am = a.slot.dayOfWeek * 1440 + a.slot.hour * 60 + a.slot.minute;
      const bm = b.slot.dayOfWeek * 1440 + b.slot.hour * 60 + b.slot.minute;
      return am - bm;
    })
    .slice(0, MAX_SCHEDULED);

  let count = 0;
  for (const { slot, sample } of upcoming) {
    const subject = sample.subject || 'Lesson';
    const room = sample.locations[0] ? ` · ${sample.locations[0]}` : '';
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `lesson-${keyOf(slot)}`,
        content: {
          title: `${subject} starts in ${leadMinutes} min`,
          body: `${formatTime(sample.start)}–${formatTime(sample.end)}${room}`,
          sound: false,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          channelId: CHANNEL_ID,
          repeats: true,
          weekday: slot.dayOfWeek,
          hour: slot.hour,
          minute: slot.minute,
        },
      });
      count += 1;
    } catch {
      // Individual trigger failure shouldn't abort the rest.
    }
  }
  return count;
}

export async function cancelAllReminders() {
  if (!notificationsSupported()) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function keyOf(slot: WeeklySlot): string {
  return `${slot.dayOfWeek}-${slot.hour}-${slot.minute}`;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
