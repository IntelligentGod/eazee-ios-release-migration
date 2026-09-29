import { Q } from '@nozbe/watermelondb';
import { addDays, format } from 'date-fns';

import { database } from '@/database/database';
import TodoModel from '@/database/models/TodoModel';
import { fetchCalendarEventsInRange, type RangeCalendarEvent } from '@/lib/calendarRange';
import {
  DEFAULT_LIFE_GRAPH_SETTINGS,
  computeLifeGraphProgress,
  getLifeGraphWeekStart,
  readLifeGraphSettings,
  type LifeGraphNodeId,
  type LifeGraphNodeProgress,
  type LifeGraphSettings,
} from '@/lib/lifeGraph';
import { inferGoalTimeframeFromDueDate } from '@/utils/goalTimeframes';

/** Fix my life always plans a Monday to Sunday week. */
const WEEK_STARTS_ON_MONDAY = 1;
/** Keeps the context message a reasonable size for the model. */
const MAX_LISTED_TASKS = 60;

export type WeekPlanTask = {
  title: string;
  dueDate?: Date;
  hasDueTime: boolean;
  isOverdue: boolean;
  starred: boolean;
};

export type WeekPlanGoal = { title: string };

export type WeekPlanInput = {
  now: Date;
  weekStart: Date;
  events: RangeCalendarEvent[];
  tasks: WeekPlanTask[];
  goals: WeekPlanGoal[];
  lifeGraph: LifeGraphSettings;
  lifeGraphProgress: Record<LifeGraphNodeId, LifeGraphNodeProgress>;
};

const toDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

/** Today through Sunday; days already past are not replanned. */
export function getWeekPlanDates(now: Date, weekStart: Date) {
  const todayKey = toDateKey(now);
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(weekStart, index)))
    .filter((dateKey) => dateKey >= todayKey);
}

const describeTask = (task: WeekPlanTask) => {
  const when = task.isOverdue
    ? `overdue since ${format(task.dueDate!, 'EEE MMM d')}`
    : task.dueDate
      ? `due ${format(task.dueDate, task.hasDueTime ? 'EEE MMM d h:mm a' : 'EEE MMM d')}`
      : 'no date';
  return `- "${task.title}" (${when}${task.starred ? ', starred' : ''})`;
};

const describeEvent = (event: RangeCalendarEvent) =>
  event.isAllDay
    ? `- ${format(event.startDate, 'EEE MMM d')} all day: ${event.title}`
    : `- ${format(event.startDate, 'EEE MMM d h:mm a')}${event.endDate ? `-${format(event.endDate, 'h:mm a')}` : ''}: ${event.title}`;

/**
 * The system message that drives a Fix my life conversation. It stays attached to
 * every request in that chat, so later turns still know the week and the rules.
 */
export function buildWeekPlanContext(input: WeekPlanInput) {
  const weekEnd = addDays(input.weekStart, 6);
  const planDates = getWeekPlanDates(input.now, input.weekStart);
  const enabledNodes = input.lifeGraph.nodes.filter((node) => node.enabled);

  const sections = [
    'FIX MY LIFE WEEK PLAN MODE.',
    `The user tapped "Fix my life" to plan their week of ${format(input.weekStart, 'EEE MMM d')} to ${format(weekEnd, 'EEE MMM d')}. Today is ${format(input.now, 'EEEE MMM d')}.`,
    '',
    'Follow these steps across the conversation:',
    '1. FIRST reply, before planning anything: in one short message, briefly say what you see (busiest day, overdue tasks, goals, life areas behind), then ask 2-3 short questions about what else needs to happen this week, commitments missing from the calendar, and their top priority. Do not call any tool yet.',
    `2. After the user answers, call plan_my_day once for EACH of these dates, in order: ${planDates.join(', ')}. For each day:`,
    '   - Calendar events and timed tasks already on that day are added automatically as blockers. Do not include them as items.',
    '   - Spread the undated and overdue tasks below across the week. Use each task\'s exact title so saving reschedules it instead of creating a duplicate.',
    '   - Add focused work sessions for the This Week goals below, as tasks named after the goal.',
    '   - Add at least one activity during the week for each life area that is behind its weekly target.',
    '   - Add anything the user mentioned in their answers.',
    '   - Keep each day realistic: no more than about 6 new items, and leave some days lighter.',
    '3. After all day plans are drafted: reply with a short week summary, then point out any remaining gaps (life areas still behind, goals with no time, overloaded days) and ask whether to add or change anything. Remind them to review each day and tap Save on the day cards they want.',
    'If the user asks for changes to a day, call plan_my_day again for only that date with the updated items.',
    '',
    `Calendar events this week (${input.events.length}):`,
    ...(input.events.length ? input.events.map(describeEvent) : ['- none']),
    '',
    `Open tasks for this week, overdue or undated (${input.tasks.length}):`,
    ...(input.tasks.length ? input.tasks.slice(0, MAX_LISTED_TASKS).map(describeTask) : ['- none']),
    '',
    `This Week goals (${input.goals.length}):`,
    ...(input.goals.length ? input.goals.map((goal) => `- "${goal.title}"`) : ['- none']),
    '',
    'Life areas (the user\'s Life Graph; completed related tasks this week vs weekly target):',
    ...(enabledNodes.length
      ? enabledNodes.map((node) => {
        const { completedCount } = input.lifeGraphProgress[node.id];
        const status = completedCount >= node.weeklyTarget ? 'on track' : 'behind';
        return `- ${node.name}: ${completedCount}/${node.weeklyTarget} (${status}); related words: ${node.keywords.join(', ') || 'none'}`;
      })
      : ['- none set up']),
  ];

  return sections.join('\n');
}

export async function loadWeekPlanContext(userId: string | null | undefined, now = new Date()) {
  const weekStart = getLifeGraphWeekStart(now, WEEK_STARTS_ON_MONDAY);
  const weekEndExclusive = addDays(weekStart, 7);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [events, openTodos, lifeGraph, completedThisWeek] = await Promise.all([
    fetchCalendarEventsInRange(weekStart, weekEndExclusive),
    database.get<TodoModel>('todos')
      .query(Q.where('completed', false), Q.where('workspace', Q.notEq('Wishlist')))
      .fetch(),
    userId ? readLifeGraphSettings(userId) : Promise.resolve(null),
    database.get<TodoModel>('todos')
      .query(Q.where('completed', true), Q.where('updated_at', Q.gte(weekStart.getTime())))
      .fetch(),
  ]);

  const goals = openTodos
    .filter((todo) => todo.workspace === 'Goals')
    .filter((todo) => (todo.goalTimeframe || inferGoalTimeframeFromDueDate(todo.dueDate, WEEK_STARTS_ON_MONDAY, now)) === 'thisWeek')
    .map((todo) => ({ title: todo.text }));

  const tasks = openTodos
    .filter((todo) => todo.workspace !== 'Goals')
    .filter((todo) => !todo.dueDate || todo.dueDate.getTime() < weekEndExclusive.getTime())
    .map((todo) => ({
      title: todo.text,
      dueDate: todo.dueDate,
      hasDueTime: !!todo.hasDueTime,
      isOverdue: !!todo.dueDate && todo.dueDate.getTime() < todayStart.getTime(),
      starred: !!todo.starred,
    }))
    .sort((left, right) => Number(right.isOverdue) - Number(left.isOverdue) || Number(right.starred) - Number(left.starred));

  const settings = lifeGraph ?? DEFAULT_LIFE_GRAPH_SETTINGS;
  const lifeGraphProgress = computeLifeGraphProgress(
    settings,
    completedThisWeek.map((todo) => ({ text: todo.text, details: todo.details, completedAt: todo.updatedAt })),
    weekStart
  );

  return buildWeekPlanContext({ now, weekStart, events, tasks, goals, lifeGraph: settings, lifeGraphProgress });
}
