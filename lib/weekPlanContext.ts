import { Q } from '@nozbe/watermelondb';
import { addDays, format } from 'date-fns';

import { database } from '@/database/database';
import GoalGuidancePlanModel from '@/database/models/GoalGuidancePlanModel';
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
const MAX_LISTED_WISHLIST_ITEMS = 20;
const MAX_LISTED_LONGER_GOALS = 8;
const MAX_LISTED_GOAL_STEPS = 12;

export type WeekPlanTask = {
  title: string;
  dueDate?: Date;
  hasDueTime: boolean;
  isOverdue: boolean;
  starred: boolean;
};

export type WeekPlanGoalStep = {
  title: string;
  details?: string;
  cadence?: 'once' | 'daily';
  effort?: 'light' | 'medium' | 'heavy';
  done: boolean;
  active: boolean;
};

/** A This Week goal, with its plan steps when the user has set up guidance for it. */
export type WeekPlanGoal = {
  title: string;
  details?: string;
  deadline?: Date;
  steps?: WeekPlanGoalStep[];
};

export type WeekPlanLongerGoal = { title: string; timeframe: 'thisMonth' | 'thisYear' | 'longTerm' };

export type WeekPlanWishlistItem = { title: string; details?: string };

export type WeekPlanInput = {
  now: Date;
  weekStart: Date;
  events: RangeCalendarEvent[];
  tasks: WeekPlanTask[];
  goals: WeekPlanGoal[];
  longerGoals?: WeekPlanLongerGoal[];
  wishlist?: WeekPlanWishlistItem[];
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

const describeGoal = (goal: WeekPlanGoal) => {
  const lines = [`- "${goal.title}"${goal.deadline ? ` (deadline ${format(goal.deadline, 'EEE MMM d')})` : ''}`];
  if (goal.details?.trim()) lines.push(`  Details: ${goal.details.trim()}`);
  const remaining = (goal.steps ?? []).filter((step) => !step.done);
  if (goal.steps?.length) {
    lines.push(`  Plan steps (${remaining.length} of ${goal.steps.length} left, in order):`);
    lines.push(...remaining.slice(0, MAX_LISTED_GOAL_STEPS).map((step) => {
      const tags = [step.cadence === 'daily' ? 'daily' : 'once', step.effort, step.active ? 'current step' : null].filter(Boolean);
      return `  - ${step.title} (${tags.join(', ')})${step.details?.trim() ? `: ${step.details.trim()}` : ''}`;
    }));
  } else {
    lines.push('  No plan steps yet: break it into concrete daily steps yourself.');
  }
  return lines;
};

const LONGER_GOAL_LABELS: Record<WeekPlanLongerGoal['timeframe'], string> = {
  thisMonth: 'this month',
  thisYear: 'this year',
  longTerm: 'long term',
};

/**
 * The system message that drives a Fix my life conversation. It stays attached to
 * every request in that chat, so later turns still know the week and the rules.
 * The week is planned around the user's goal for this week: from Goals, or asked
 * for and saved as a goal first. To Do tasks, calendar events and wishlist items
 * are fitted around it.
 */
export function buildWeekPlanContext(input: WeekPlanInput) {
  const weekEnd = addDays(input.weekStart, 6);
  const planDates = getWeekPlanDates(input.now, input.weekStart);
  const enabledNodes = input.lifeGraph.nodes.filter((node) => node.enabled);
  const longerGoals = (input.longerGoals ?? []).slice(0, MAX_LISTED_LONGER_GOALS);
  const wishlist = (input.wishlist ?? []).slice(0, MAX_LISTED_WISHLIST_ITEMS);
  const hasWeekGoal = input.goals.length > 0;

  const firstStep = hasWeekGoal
    ? '1. FIRST reply, before planning anything: in one short message, name this week\'s goal(s) below and briefly say what you see (busiest day, overdue tasks, life areas behind). Ask whether the goal is still their focus this week, plus 1-2 short questions about commitments missing from the calendar and anything else that must happen. Do not call any tool yet.'
    : '1. FIRST reply, before planning anything: the user has no goal for this week yet, and the week is planned around one. In one short message, briefly say what you see, then ask what they want to achieve this week. Offer 1-2 concrete suggestions drawn from their longer goals, wishlist or life areas behind, and ask about commitments missing from the calendar. Do not call any tool yet.';

  const sections = [
    'FIX MY LIFE WEEK PLAN MODE.',
    `The user tapped "Fix my life" to plan their week of ${format(input.weekStart, 'EEE MMM d')} to ${format(weekEnd, 'EEE MMM d')}. Today is ${format(input.now, 'EEEE MMM d')}.`,
    'The whole week is built around the user\'s goal for this week. Their To Do tasks, calendar, Goals and Wishlist below all feed the plan.',
    '',
    'Follow these steps across the conversation:',
    firstStep,
    '2. Once the user has answered, plan the whole week in ONE response. If they gave a goal for this week that is not already in the This Week goals below, call goal_create with timeframe thisWeek and a short title, and call plan_my_week in that same response. If they confirmed an existing goal, keep it. Do not create duplicate goals.',
    `3. Call plan_my_week exactly once, with one entry in days for EACH of these dates, in order: ${planDates.join(', ')}. Today is included. Never plan only one day, and never use plan_my_day for this.`,
    '   - Each day has exactly ONE plan: its mainGoal, a concrete step toward the week goal in a few words, such as "Record pronunciation baseline". No timeline, no times, no extra tasks and no details.',
    '   - Follow the goal\'s plan steps in order (one-off steps once, daily steps can repeat, heavier steps on days with fewer calendar events). If a goal has no steps, break it into small daily steps yourself, building up across the week.',
    '   - On a lighter day, the main goal can be an overdue To Do task below or a "Buy <item>" for a wishlist item that supports the week goal, but only when it moves the goal forward. Leave unrelated tasks and wishlist items out.',
    '4. The app shows one card per day with its main goal. When the user replies after that, point out any remaining gaps (goal steps not scheduled, life areas still behind) if they ask, and remind them to tap Save on the days they want.',
    'If the user asks for changes to one day, call plan_my_week again with only that date and its new main goal. If they ask to replan the week, call plan_my_week again with every remaining date.',
    '',
    `This Week goals (${input.goals.length}):`,
    ...(hasWeekGoal ? input.goals.flatMap(describeGoal) : ['- none yet: ask the user for one (step 1)']),
    '',
    `Longer-term goals (${longerGoals.length}; context for suggestions, not planned directly):`,
    ...(longerGoals.length ? longerGoals.map((goal) => `- "${goal.title}" (${LONGER_GOAL_LABELS[goal.timeframe]})`) : ['- none']),
    '',
    `Calendar events this week (${input.events.length}):`,
    ...(input.events.length ? input.events.map(describeEvent) : ['- none']),
    '',
    `Open To Do tasks for this week, overdue or undated (${input.tasks.length}):`,
    ...(input.tasks.length ? input.tasks.slice(0, MAX_LISTED_TASKS).map(describeTask) : ['- none']),
    '',
    `Wishlist (${wishlist.length}; things the user wants to buy):`,
    ...(wishlist.length ? wishlist.map((item) => `- "${item.title}"${item.details?.trim() ? `: ${item.details.trim()}` : ''}`) : ['- none']),
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

const EFFORTS = ['light', 'medium', 'heavy'] as const;

const parseJsonArray =<T,>(value: string | null | undefined): T[] => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** A goal's plan steps from its guidance plan, with which are done and which is current. */
export function readGoalPlanSteps(plan: Pick<GoalGuidancePlanModel, 'stepsJson' | 'completedStepIndexesJson' | 'activeStepIndex'>): WeekPlanGoalStep[] {
  const completed = new Set(parseJsonArray<number>(plan.completedStepIndexesJson));
  return parseJsonArray<Record<string, unknown>>(plan.stepsJson)
    .map((step, index): WeekPlanGoalStep => ({
      title: typeof step?.title === 'string' ? step.title.trim() : '',
      details: typeof step?.details === 'string' ? step.details : undefined,
      cadence: step?.cadence === 'daily' ? 'daily' as const : 'once' as const,
      effort: EFFORTS.find((effort) => effort === step?.effort),
      done: completed.has(index),
      active: index === plan.activeStepIndex && !completed.has(index),
    }))
    .filter((step) => step.title);
}

export async function loadWeekPlanContext(userId: string | null | undefined, now = new Date()) {
  const weekStart = getLifeGraphWeekStart(now, WEEK_STARTS_ON_MONDAY);
  const weekEndExclusive = addDays(weekStart, 7);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [events, openTodos, lifeGraph, completedThisWeek] = await Promise.all([
    fetchCalendarEventsInRange(weekStart, weekEndExclusive),
    database.get<TodoModel>('todos').query(Q.where('completed', false)).fetch(),
    userId ? readLifeGraphSettings(userId) : Promise.resolve(null),
    database.get<TodoModel>('todos')
      .query(Q.where('completed', true), Q.where('updated_at', Q.gte(weekStart.getTime())))
      .fetch(),
  ]);

  const goalTodos = openTodos.filter((todo) => todo.workspace === 'Goals');
  const timeframeOf = (todo: TodoModel) =>
    todo.goalTimeframe || inferGoalTimeframeFromDueDate(todo.dueDate, WEEK_STARTS_ON_MONDAY, now);
  const weekGoalTodos = goalTodos.filter((todo) => timeframeOf(todo) === 'thisWeek');

  // The latest plan per goal; an accepted plan wins over a preview the user never confirmed.
  const plans = weekGoalTodos.length
    ? await database.get<GoalGuidancePlanModel>('goal_guidance_plans')
      .query(Q.where('goal_id', Q.oneOf(weekGoalTodos.map((todo) => todo.id))))
      .fetch()
    : [];
  const planByGoalId = new Map<string, GoalGuidancePlanModel>();
  for (const plan of plans) {
    const current = planByGoalId.get(plan.goalId);
    const rank = (candidate: GoalGuidancePlanModel) => (candidate.status === 'preview' ? 0 : 1);
    if (!current || rank(plan) > rank(current) || (rank(plan) === rank(current) && plan.updatedAt > current.updatedAt)) {
      planByGoalId.set(plan.goalId, plan);
    }
  }

  const goals: WeekPlanGoal[] = weekGoalTodos.map((todo) => {
    const plan = planByGoalId.get(todo.id);
    return {
      title: todo.text,
      details: todo.details,
      deadline: plan?.deadline ?? todo.dueDate,
      steps: plan ? readGoalPlanSteps(plan) : undefined,
    };
  });

  const longerGoals = goalTodos
    .map((todo) => ({ title: todo.text, timeframe: timeframeOf(todo) }))
    .filter((goal): goal is WeekPlanLongerGoal =>
      goal.timeframe === 'thisMonth' || goal.timeframe === 'thisYear' || goal.timeframe === 'longTerm');

  const wishlist = openTodos
    .filter((todo) => todo.workspace === 'Wishlist')
    .map((todo) => ({ title: todo.text, details: todo.details }));

  const tasks = openTodos
    .filter((todo) => todo.workspace !== 'Goals' && todo.workspace !== 'Wishlist')
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

  return buildWeekPlanContext({ now, weekStart, events, tasks, goals, longerGoals, wishlist, lifeGraph: settings, lifeGraphProgress });
}
