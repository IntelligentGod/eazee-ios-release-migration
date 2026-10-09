import { Q } from '@nozbe/watermelondb';
import { addDays, startOfDay } from 'date-fns';
import { database } from '@/database/database';
import TodoModel from '@/database/models/TodoModel';
import { fetchCalendarEventsInRange, type RangeCalendarEvent } from '@/lib/calendarRange';
import { getTodoHasDueTime } from '@/utils/todoDates';

/** How many days after today the Home "plan" card can show. */
export const HOME_PLAN_MAX_DAY_OFFSET = 6;

export type HomeDayPlanItem = {
  id: string;
  sourceId: string;
  label: string;
  type: 'event' | 'todo';
  time?: Date;
  endTime?: Date;
  hasTime: boolean;
  isStarred?: boolean;
  completionSource?: 'local' | 'google';
  completionKey?: string;
  workspaceKey?: string;
};

/** "Today's plan", "Tomorrow's plan", then the weekday: "Wednesday's plan". */
export function getHomePlanTitle(dayOffset: number, day: Date) {
  if (dayOffset <= 0) return "Today's plan";
  if (dayOffset === 1) return "Tomorrow's plan";
  return `${day.toLocaleDateString(undefined, { weekday: 'long' })}'s plan`;
}

export function getHomePlanDay(today: Date, dayOffset: number) {
  return addDays(startOfDay(today), dayOffset);
}

/** Timed items by time, then all-day events, then tasks without a time. */
export function orderHomeDayPlanItems(items: HomeDayPlanItem[]) {
  const timed = items.filter((item) => item.hasTime && item.time)
    .sort((left, right) => left.time!.getTime() - right.time!.getTime());
  const allDayEvents = items.filter((item) => item.type === 'event' && !(item.hasTime && item.time));
  const untimedTodos = items.filter((item) => item.type === 'todo' && !(item.hasTime && item.time));
  return [...timed, ...allDayEvents, ...untimedTodos];
}

export function toHomeDayPlanEventItem(event: RangeCalendarEvent): HomeDayPlanItem {
  return {
    id: `event-${event.id}`,
    sourceId: event.id,
    label: event.title || 'Untitled event',
    type: 'event',
    time: event.startDate,
    endTime: event.endDate,
    hasTime: !event.isAllDay,
    completionSource: event.source || 'local',
    completionKey: event.openId || event.id,
  };
}

/** Events and open tasks for one future day, in the same shape as the today list. */
export async function loadHomeDayPlanItems(day: Date): Promise<HomeDayPlanItem[]> {
  const start = startOfDay(day);
  const endExclusive = addDays(start, 1);
  const [events, todos] = await Promise.all([
    fetchCalendarEventsInRange(start, endExclusive).catch(() => [] as RangeCalendarEvent[]),
    database.get<TodoModel>('todos')
      .query(
        Q.where('completed', false),
        Q.where('due_date', Q.gte(start.getTime())),
        Q.where('due_date', Q.lt(endExclusive.getTime()))
      )
      .fetch(),
  ]);

  const todoItems = todos
    // Goals and wishlist items have their own tabs and are not day plans.
    .filter((todo) => todo.workspace !== 'Goals' && todo.workspace !== 'Wishlist')
    .map((todo): HomeDayPlanItem => {
      const hasTime = getTodoHasDueTime(todo.dueDate, todo.hasDueTime);
      return {
        id: `todo-${todo.id}`,
        sourceId: todo.id,
        label: todo.text,
        type: 'todo',
        hasTime,
        isStarred: todo.starred,
        workspaceKey: todo.workspace,
        ...(hasTime && todo.dueDate ? { time: todo.dueDate } : {}),
      };
    });

  return orderHomeDayPlanItems([...events.map(toHomeDayPlanEventItem), ...todoItems]);
}
