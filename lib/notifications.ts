import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { addDays } from 'date-fns';
import { dateKey, fromMinutes, isoWeekday, toMinutes, formatTime12, safeParse } from './dates';
import type { AppData, Weekday } from './types';

// Local (on-device) notifications only. No push server, no account.

const CHANNEL = 'reminders';
const STUDY_ID = 'study-timer';
const DAILY_PREFIX = 'daily-';
const DAILY_DAYS = 7;
const supported = Platform.OS === 'ios' || Platform.OS === 'android';
// iOS keeps at most 64 pending notifications per app. Classes and deadlines
// get 52, the evening reminder 7, the study timer 1.
const MAX_SCHEDULED = 52;

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let channelReady = false;

async function ensureChannel() {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Class and deadline reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
  });
  channelReady = true;
}

/** Ask for permission once. Returns true when reminders can be shown. */
export async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** ISO weekday (1 = Mon) -> expo weekday (1 = Sun). */
const toExpoWeekday = (d: Weekday) => (d % 7) + 1;

type Planned = { id: string; when: number; request: Notifications.NotificationRequestInput };

/**
 * Cancel and re-create every class and deadline reminder from the current data.
 * The study timer's own reminder is left alone.
 */
export async function rescheduleAll(data: AppData): Promise<void> {
  if (!supported) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await ensureChannel();

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((n) => n.identifier !== STUDY_ID && !n.identifier.startsWith(DAILY_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const subjects = new Map(data.subjects.map((s) => [s.id, s]));
  const planned: Planned[] = [];
  const now = Date.now();

  // Weekly class reminders
  const before = data.settings.classReminderMinutes;
  if (before > 0) {
    for (const slot of data.slots) {
      const subject = subjects.get(slot.subjectId);
      if (!subject) continue;
      const startMin = toMinutes(slot.start);
      let at = startMin - before;
      let day = slot.day as number;
      if (at < 0) {
        // Reminder falls on the previous day (e.g. a 12:05 AM class)
        at += 1440;
        day = day === 1 ? 7 : day - 1;
      }
      const [hour, minute] = fromMinutes(at).split(':').map(Number);
      planned.push({
        id: `class-${slot.id}`,
        when: 0, // recurring: always keep
        request: {
          identifier: `class-${slot.id}`,
          content: {
            title: `${subject.name} in ${before} min`,
            body: `${formatTime12(slot.start)}${slot.room ? ` · ${slot.room}` : ''}${slot.kind !== 'lecture' ? ` · ${slot.kind}` : ''}`,
            data: { kind: 'class', slotId: slot.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: toExpoWeekday(day as Weekday),
            hour,
            minute,
            channelId: CHANNEL,
          },
        },
      });
    }
  }

  // One-off deadline reminders: a day before and an hour before
  if (data.settings.deadlineReminders) {
    for (const d of data.deadlines) {
      if (d.done) continue;
      const due = safeParse(d.due);
      if (!due) continue;
      const subjectName = d.subjectId ? subjects.get(d.subjectId)?.name : undefined;
      const label = subjectName ? `${subjectName}: ${d.title}` : d.title;
      const offsets: [string, number, string][] = [
        ['1d', 24 * 60 * 60 * 1000, 'due tomorrow'],
        ['1h', 60 * 60 * 1000, 'due in 1 hour'],
      ];
      for (const [tag, ms, phrase] of offsets) {
        const when = due.getTime() - ms;
        if (when <= now + 30_000) continue;
        planned.push({
          id: `dl-${d.id}-${tag}`,
          when,
          request: {
            identifier: `dl-${d.id}-${tag}`,
            content: {
              title: `${capitalize(d.type)} ${phrase}`,
              body: label,
              data: { kind: 'deadline', deadlineId: d.id },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: when,
              channelId: CHANNEL,
            },
          },
        });
      }
    }
  }

  // Classes first (they repeat every week), then the soonest deadlines
  planned.sort((a, b) => a.when - b.when);
  for (const p of planned.slice(0, MAX_SCHEDULED)) {
    try {
      await Notifications.scheduleNotificationAsync(p.request);
    } catch (e) {
      console.warn('Could not schedule', p.id, e);
    }
  }
}

/**
 * Evening "mark today's attendance" reminder for the next 7 days that have
 * classes. Local notifications can't check anything when they fire, so today's
 * reminder is simply not scheduled once every class today is marked; this runs
 * again whenever a mark changes.
 */
export async function rescheduleDaily(data: AppData): Promise<void> {
  if (!supported) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await ensureChannel();

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((n) => n.identifier.startsWith(DAILY_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const at = data.settings.dailyReminder;
  if (!at) return;
  const subjectIds = new Set(data.subjects.map((s) => s.id));
  const mins = toMinutes(at);
  const now = Date.now();

  for (let i = 0; i < DAILY_DAYS; i++) {
    const day = addDays(new Date(), i);
    const key = dateKey(day);
    const slots = data.slots.filter((s) => s.day === isoWeekday(day) && subjectIds.has(s.subjectId));
    if (slots.length === 0) continue;
    const marked = new Set(data.records.filter((r) => r.date === key && r.slotId).map((r) => r.slotId));
    const left = slots.filter((s) => !marked.has(s.id)).length;
    if (left === 0) continue;
    const when = new Date(day);
    when.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    if (when.getTime() <= now + 30_000) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${DAILY_PREFIX}${key}`,
        content: {
          title: 'Mark today’s attendance',
          body: `${left} class${left === 1 ? '' : 'es'} not marked yet. It takes a few seconds.`,
          data: { kind: 'daily' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when.getTime(), channelId: CHANNEL },
      });
    } catch (e) {
      console.warn('Could not schedule daily reminder', e);
    }
  }
}

export async function scheduleStudyEnd(endsAt: number, label: string): Promise<void> {
  if (!supported) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await ensureChannel();
  await cancelStudyEnd();
  await Notifications.scheduleNotificationAsync({
    identifier: STUDY_ID,
    content: {
      title: 'Study session complete',
      body: label ? `Nice work on ${label}. Take a short break.` : 'Nice work. Take a short break.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endsAt, channelId: CHANNEL },
  });
}

export async function cancelStudyEnd(): Promise<void> {
  if (!supported) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(STUDY_ID);
  } catch {
    // nothing scheduled
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}