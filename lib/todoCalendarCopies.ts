import { Q } from '@nozbe/watermelondb';

import { getAccessTokenStatic } from '@/app/context/TokenContext';
import { database } from '@/database/database';
import EventModel from '@/database/models/EventModel';

/** Google event ids of the given local events, for removing their Google copies. */
export const collectGoogleEventIds = (events: Pick<EventModel, 'googleEventId'>[]) =>
  [...new Set(events.map((event) => String(event.googleEventId || '').trim()).filter(Boolean))];

async function deleteGoogleEvent(token: string, googleEventId: string) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
  // Already gone on Google counts as done.
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    console.warn('Could not delete the Google copy of a task event:', response.status);
  }
}

/**
 * Deletes the calendar events made from these tasks ("Send to Calendar"), in the
 * app and their copies on Google Calendar. Google is best effort: when it is not
 * connected or offline, only the app's events are removed.
 */
export async function deleteCalendarCopiesForTodos(todoIds: string[]) {
  if (!todoIds.length) return;
  const events = await database
    .get<EventModel>('events')
    .query(Q.where('source_todo_id', Q.oneOf(todoIds)))
    .fetch();
  if (!events.length) return;

  const googleEventIds = collectGoogleEventIds(events);
  await database.write(async () => {
    await database.batch(events.map((event) => event.prepareDestroyPermanently()));
  });

  if (!googleEventIds.length) return;
  const token = await getAccessTokenStatic().catch(() => null);
  if (!token) return;
  for (const googleEventId of googleEventIds) {
    await deleteGoogleEvent(token, googleEventId).catch((error) =>
      console.warn('Could not delete the Google copy of a task event:', error)
    );
  }
}
