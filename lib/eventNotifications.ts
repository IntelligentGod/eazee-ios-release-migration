import AsyncStorage from '@react-native-async-storage/async-storage';
import { Q } from '@nozbe/watermelondb';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getAccessTokenStatic } from '@/app/context/TokenContext';
import { database } from '@/database/database';
import EventModel from '@/database/models/EventModel';
import { configureTodoNotifications } from '@/lib/todoNotifications';
import { parseCalendarDateValue } from '@/utils/calendarDates';
import { WAVE_EVENT_DESCRIPTION_SENTINEL } from '@/utils/calendarDetails';

export const EVENT_REMINDER_MINUTE_OPTIONS = [5, 10, 15] as const;
export type EventReminderMinutes = (typeof EVENT_REMINDER_MINUTE_OPTIONS)[number];

export type EventReminderSettings = {
  /** null turns event reminders off. */
  minutesBefore: EventReminderMinutes | null;
};

export const DEFAULT_EVENT_REMINDER_SETTINGS: EventReminderSettings = { minutesBefore: 10 };

const EVENT_REMINDER_SETTINGS_KEY = 'eventReminders:settings:v1';
const EVENT_REMINDER_CHANNEL_ID = 'event-reminders';
const EVENT_REMINDER_KIND = 'event_reminder';
/** How far ahead reminders are scheduled; the app re-syncs every time it opens. */
const EVENT_REMINDER_LOOKAHEAD_DAYS = 7;
/** iOS keeps at most 64 pending notifications per app, shared with todo reminders. */
const MAX_SCHEDULED_EVENT_REMINDERS = 30;

export type ReminderEventInput = {
  id: string;
  title: string;
  startDate: Date;
  isAllDay: boolean;
  location?: string;
};

export type PlannedEventReminder = {
  eventId: string;
  triggerDate: Date;
  title: string;
  body: string;
};

/** All-day events have no start time to count down from, so they get no reminder. */
export function planEventReminders(
  events: ReminderEventInput[],
  minutesBefore: EventReminderMinutes,
  now: Date
): PlannedEventReminder[] {
  return events
    .filter((event) => !event.isAllDay)
    .map((event) => ({ event, triggerDate: new Date(event.startDate.getTime() - minutesBefore * 60_000) }))
    .filter(({ triggerDate }) => triggerDate.getTime() > now.getTime())
    .sort((left, right) => left.triggerDate.getTime() - right.triggerDate.getTime())
    .slice(0, MAX_SCHEDULED_EVENT_REMINDERS)
    .map(({ event, triggerDate }) => ({
      eventId: event.id,
      triggerDate,
      title: event.title.trim() || 'Upcoming event',
      body: `Starts in ${minutesBefore} minutes${event.location?.trim() ? ` · ${event.location.trim()}` : ''}`,
    }));
}

export async function readEventReminderSettings(): Promise<EventReminderSettings> {
  try {
    const stored = await AsyncStorage.getItem(EVENT_REMINDER_SETTINGS_KEY);
    if (!stored) return DEFAULT_EVENT_REMINDER_SETTINGS;
    const minutesBefore = JSON.parse(stored)?.minutesBefore;
    return {
      minutesBefore: EVENT_REMINDER_MINUTE_OPTIONS.includes(minutesBefore) ? minutesBefore : null,
    };
  } catch {
    return DEFAULT_EVENT_REMINDER_SETTINGS;
  }
}

export async function writeEventReminderSettings(settings: EventReminderSettings) {
  try {
    await AsyncStorage.setItem(EVENT_REMINDER_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save event reminder settings', error);
  }
}

async function fetchLocalEvents(start: Date, end: Date): Promise<ReminderEventInput[]> {
  const rows = await database.collections
    .get<EventModel>('events')
    .query(Q.where('start_date', Q.gte(start.getTime())), Q.where('start_date', Q.lt(end.getTime())))
    .fetch();

  return rows
    // Events mirrored from a todo already get that todo's own reminder.
    .filter((row) => !row.isTodo && !row.sourceTodoId)
    .map((row) => ({
      id: row.googleEventId || row.id,
      title: row.title,
      startDate: row.startDate,
      isAllDay: false,
      location: row.location,
    }));
}

async function fetchGoogleEvents(start: Date, end: Date): Promise<ReminderEventInput[]> {
  const token = await getAccessTokenStatic();
  if (!token) return [];

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    start.toISOString()
  )}&timeMax=${encodeURIComponent(end.toISOString())}&singleEvents=true&orderBy=startTime`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!response.ok) return [];

  const data = await response.json().catch(() => ({}));
  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  return items
    .filter((item) => item?.status !== 'cancelled' && item?.description !== WAVE_EVENT_DESCRIPTION_SENTINEL)
    .flatMap((item) => {
      const startDate = parseCalendarDateValue(item.start?.dateTime || item.start?.date);
      if (!startDate) return [];
      return [{
        id: String(item.id),
        title: String(item.summary || ''),
        startDate,
        isAllDay: !!(item.start?.date && !item.start?.dateTime),
        location: typeof item.location === 'string' ? item.location : undefined,
      }];
    });
}

export async function cancelScheduledEventReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.content.data?.kind === EVENT_REMINDER_KIND)
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier))
  );
}

let syncInFlight: Promise<void> | null = null;
let syncRequestedDuringFlight = false;

/**
 * Replaces every scheduled event reminder with a fresh set for the next week of
 * local and Google Calendar events. Safe to call often; overlapping calls are merged.
 */
export function syncEventReminders(): Promise<void> {
  if (syncInFlight) {
    syncRequestedDuringFlight = true;
    return syncInFlight;
  }

  syncInFlight = (async () => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    const { minutesBefore } = await readEventReminderSettings();
    await cancelScheduledEventReminders();
    if (!minutesBefore) return;

    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted) return;

    await configureTodoNotifications();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(EVENT_REMINDER_CHANNEL_ID, {
        name: 'Event reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    const now = new Date();
    const end = new Date(now.getTime() + EVENT_REMINDER_LOOKAHEAD_DAYS * 24 * 60 * 60_000);
    const [localEvents, googleEvents] = await Promise.all([
      fetchLocalEvents(now, end),
      fetchGoogleEvents(now, end).catch(() => []),
    ]);
    // A local copy of a Google event shares its id, so Google's version wins.
    const eventsById = new Map([...localEvents, ...googleEvents].map((event) => [event.id, event]));

    for (const reminder of planEventReminders([...eventsById.values()], minutesBefore, now)) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.body,
          sound: true,
          data: { kind: EVENT_REMINDER_KIND, eventId: reminder.eventId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.triggerDate,
          channelId: Platform.OS === 'android' ? EVENT_REMINDER_CHANNEL_ID : undefined,
        } as Notifications.DateTriggerInput,
      });
    }
  })().finally(() => {
    syncInFlight = null;
    if (syncRequestedDuringFlight) {
      syncRequestedDuringFlight = false;
      void syncEventReminders();
    }
  });

  return syncInFlight;
}
