import { Q } from '@nozbe/watermelondb';
import { database } from '../../../../database/database';
import TodoModel from '../../../../database/models/TodoModel';
import EventModel from '../../../../database/models/EventModel';
import { getAccessTokenStatic } from '@/app/context/TokenContext';
import type { ToolHandler } from './todo';
import { classifyCreatedTodoItemsInBackground, createTodoItems } from './todo';
import { createCalendarEvent } from './calendar';
import { parseCalendarDateValue } from '@/utils/calendarDates';
import { getTodoHasDueTime, parseTodoInput } from '@/utils/todoDates';
import { isSupportedTodoWorkspaceKey } from '@/lib/todoWorkspaces';
import { SERVER_URL } from '@/config/backend';
import { getAiRequestHeaders } from '@/lib/aiRequest';
import { appendCreatedCalendarItems, appendCreatedTodoItems, getLastDayPlan, setLastCalendarItems, setLastQueryItems } from './memory';
import {
  buildDayPlanCardValue,
  getTimelineDurationMinutes,
  replanTimelineItems,
  type DayPlanTimeSource,
  type DayPlanTimelineItem,
} from '../dayPlan';

const toLocalYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toIso = (d: Date | string): string => {
  const date = parseCalendarDateValue(d);
  return (date || new Date()).toISOString();
};

const EVENT_LIKE_RE = /\b(birthday|meeting|coffee|lunch|dinner|appointment|call|interview|event|hangout|doctor|dentist|breakfast|brunch|visit)\b/i;
const HIGH_PRIORITY_RE = /\b(major priority|top priority|highest priority|urgent|important|priority)\b/i;
const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;
const TIME_TOKEN_RE = '(?:[1-9]|1[0-2])(?::[0-5]\\d)?\\s*(?:am|pm)|(?:[01]?\\d|2[0-3]):[0-5]\\d';
const EVENT_TIME_RANGE_RE = new RegExp(`\\b(?:from\\s+|at\\s+)?(${TIME_TOKEN_RE})\\s*(?:-|to|until)\\s*(${TIME_TOKEN_RE})\\b`, 'i');
const EXISTING_TODO_FALLBACK_DURATION_MINUTES = 45;
const DAY_PLAN_BLOCKER_TIMEOUT_MS = 1800;
const DAY_PLAN_NETWORK_TIMEOUT_MS = 1400;
const DAYPART_WINDOWS = [
  { key: 'night', pattern: /\b(?:tonight|night|nighttime)\b/i, startHour: 19, endHour: 21 },
  { key: 'evening', pattern: /\b(?:evening)\b/i, startHour: 17, endHour: 21 },
  { key: 'afternoon', pattern: /\b(?:afternoon)\b/i, startHour: 12, endHour: 17 },
  { key: 'morning', pattern: /\b(?:morning)\b/i, startHour: 9, endHour: 12 },
];
const normalizeText = (value?: unknown) => String(value || '').trim();

const withFallbackTimeout = <T,>(promise: Promise<T>, timeoutMs: number, fallback: T) =>
  new Promise<T>((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      resolve(fallback);
    }, timeoutMs);

    promise.then((value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    }).catch(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(fallback);
    });
  });

const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = DAY_PLAN_NETWORK_TIMEOUT_MS) => {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const abortTimeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await withFallbackTimeout(
      fetch(url, controller ? { ...init, signal: controller.signal } : init),
      timeoutMs,
      null
    );
  } finally {
    if (abortTimeout) clearTimeout(abortTimeout);
  }
};

const parseIsoInput = (value?: unknown) => {
  const parsed = typeof value === 'string' || value instanceof Date ? parseCalendarDateValue(value) : null;
  if (!parsed) return undefined;
  return parsed.toISOString();
};

const normalizePlanDate = (value?: unknown) => {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return toLocalYmd(parsed);
  }
  return toLocalYmd(new Date());
};

const normalizePriority = (value: unknown, text: string): 'low' | 'medium' | 'high' => {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return HIGH_PRIORITY_RE.test(text) ? 'high' : 'medium';
};

const normalizePlanTimeSource = (value: unknown): DayPlanTimeSource | undefined => {
  if (value === 'user' || value === 'ai' || value === 'none') return value;
  return undefined;
};

const normalizeDurationMinutes = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return getTimelineDurationMinutes({ durationMinutes: parsed }, 'task');
};

const getPlanDaypartWindow = (value: string) =>
  DAYPART_WINDOWS.find((window) => window.pattern.test(value));

const getStructuredDaypartWindow = (value: unknown) => {
  const normalized = normalizeText(value).toLowerCase();
  return DAYPART_WINDOWS.find((window) => window.key === normalized);
};

const hasExplicitClockTime = (value: string) =>
  new RegExp(`\\b(?:${TIME_TOKEN_RE})\\b`, 'i').test(value);

const applyDaypartStart = (date: string, startHour: number) => {
  const base = parseCalendarDateValue(date) || new Date();
  const next = new Date(base);
  next.setHours(startHour, 0, 0, 0);
  return next.toISOString();
};

const isInDaypartWindow = (value: string | undefined, window: { startHour: number; endHour: number }) => {
  const parsed = value ? parseCalendarDateValue(value) : null;
  if (!parsed) return false;
  const hourValue = parsed.getHours() + parsed.getMinutes() / 60;
  return hourValue >= window.startHour && hourValue < window.endHour;
};

const cleanDaypartText = (value: string) =>
  value
    .replace(/\b(?:in|during|for|at)\s+(?:the\s+)?(?:morning|afternoon|evening|night|nighttime)\b/gi, '')
    .replace(/\b(?:this\s+)?(?:morning|afternoon|evening|tonight|nighttime)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const cleanPlanTitle = (value: string, start: number, end: number) =>
  `${value.slice(0, start)} ${value.slice(end)}`
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\s*[-,:]\s*$/, '')
    .trim();

const parsePlanEventRange = (value: string, fallbackDate: Date) => {
  const match = EVENT_TIME_RANGE_RE.exec(value);
  if (!match) return null;

  const startDate = parseTodoInput(match[1], { fallbackDate }).dueDate;
  const endDate = parseTodoInput(match[2], { fallbackDate }).dueDate;
  if (!startDate || !endDate) return null;

  if (endDate.getTime() <= startDate.getTime()) {
    endDate.setDate(endDate.getDate() + 1);
  }

  const matchStart = match.index ?? 0;
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    cleanedText: cleanPlanTitle(value, matchStart, matchStart + match[0].length),
  };
};

const resolvePlanTodo = ({
  date,
  item,
  text,
  details,
  start,
}: {
  date: string;
  item: any;
  text: string;
  details?: string;
  start?: string;
}) => {
  const fallbackDate = parseCalendarDateValue(date) || new Date();
  const rawDueDate = parseCalendarDateValue(item?.dueDate);

  if (rawDueDate) {
    return {
      text,
      dueDate: rawDueDate.toISOString(),
      hasDueTime: getTodoHasDueTime(rawDueDate, typeof item?.hasDueTime === 'boolean' ? item.hasDueTime : undefined),
    };
  }

  if (start) {
    const startDate = new Date(start);
    return {
      text,
      dueDate: startDate.toISOString(),
      hasDueTime: getTodoHasDueTime(startDate),
    };
  }

  for (const candidate of [item?.time, item?.dueTime]) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const parsed = parseTodoInput(candidate, { fallbackDate });
    if (parsed.dueDate) {
      return {
        text,
        dueDate: parsed.dueDate.toISOString(),
        hasDueTime: parsed.hasDueTime,
      };
    }
  }

  const parsedText = parseTodoInput(text, { fallbackDate });
  if (parsedText.dueDate) {
    return {
      text: parsedText.cleanedText || text,
      dueDate: parsedText.dueDate.toISOString(),
      hasDueTime: parsedText.hasDueTime,
    };
  }

  if (details) {
    const parsedDetails = parseTodoInput(details, { fallbackDate });
    if (parsedDetails.dueDate) {
      return {
        text,
        dueDate: parsedDetails.dueDate.toISOString(),
        hasDueTime: parsedDetails.hasDueTime,
      };
    }
  }

  return {
    text,
    dueDate: normalizePlanDate(item?.dueDate || date),
    hasDueTime: false,
  };
};

const resolvePlanCalendarItem = ({
  date,
  item,
  text,
  details,
  start,
  end,
  location,
}: {
  date: string;
  item: any;
  text: string;
  details?: string;
  start?: string;
  end?: string;
  location?: string;
}) => {
  const fallbackDate = parseCalendarDateValue(date) || new Date();
  let title = text;
  let resolvedStart = start;
  let resolvedEnd = end;

  if (!resolvedStart || !resolvedEnd) {
    for (const candidate of [
      { value: normalizeText(item?.time), cleanTitle: false },
      { value: normalizeText(item?.dueTime), cleanTitle: false },
      { value: text, cleanTitle: true },
      { value: details || '', cleanTitle: false },
    ]) {
      if (!candidate.value) continue;
      const parsedRange = parsePlanEventRange(candidate.value, fallbackDate);
      if (!parsedRange) continue;
      resolvedStart = resolvedStart || parsedRange.start;
      resolvedEnd = resolvedEnd || parsedRange.end;
      if (candidate.cleanTitle && parsedRange.cleanedText) {
        title = parsedRange.cleanedText;
      }
      break;
    }
  }

  if (!resolvedStart) {
    for (const candidate of [
      { value: normalizeText(item?.time), cleanTitle: false },
      { value: normalizeText(item?.dueTime), cleanTitle: false },
      { value: text, cleanTitle: true },
      { value: details || '', cleanTitle: false },
    ]) {
      if (!candidate.value) continue;
      const parsed = parseTodoInput(candidate.value, { fallbackDate });
      if (!parsed.dueDate) continue;
      resolvedStart = parsed.dueDate.toISOString();
      if (candidate.cleanTitle && parsed.cleanedText) {
        title = parsed.cleanedText;
      }
      break;
    }
  }

  if (!resolvedEnd && resolvedStart) {
    resolvedEnd = new Date(new Date(resolvedStart).getTime() + DEFAULT_EVENT_DURATION_MS).toISOString();
  }

  return {
    title: title || text,
    start: resolvedStart,
    end: resolvedEnd,
    location,
    details,
  };
};

const plan_my_day: ToolHandler = async (args: any) => {
  const date = normalizePlanDate(args?.date);
  const rawItems: any[] = (Array.isArray(args?.items) ? args.items : [])
    .map((item: any, index: number) => ({ item, index }))
    .sort((a: { item: any; index: number }, b: { item: any; index: number }) => {
      const aOrder = Number(a.item?.order);
      const bOrder = Number(b.item?.order);
      if (Number.isFinite(aOrder) && Number.isFinite(bOrder) && aOrder !== bOrder) return aOrder - bOrder;
      if (Number.isFinite(aOrder)) return -1;
      if (Number.isFinite(bOrder)) return 1;
      return a.index - b.index;
    })
    .map(({ item }: { item: any }) => item);
  const previousPlan = getLastDayPlan();
  const previousCalendarItems = Array.isArray(previousPlan?.calendarItems) ? previousPlan.calendarItems : [];
  const previousTodoItems = Array.isArray(previousPlan?.todoItems) ? previousPlan.todoItems : [];
  const calendarItems: {
    title: string;
    start?: string;
    end?: string;
    location?: string;
    details?: string;
  }[] = [];
  const todoItems: {
    text: string;
    dueDate: string;
    hasDueTime: boolean;
    details?: string;
    starred: boolean;
    priority: 'low' | 'medium' | 'high';
    durationMinutes?: number;
  }[] = [];
  const blockerItems = await withFallbackTimeout(fetchDayPlanCalendarBlockers(date), DAY_PLAN_BLOCKER_TIMEOUT_MS, []);
  let timelineItems: DayPlanTimelineItem[] = [];

  rawItems.forEach((item: any, index: number) => {
    const text = normalizeText(item?.text);
    if (!text) return;
    const details = normalizeText(item?.details) || undefined;
    const combinedText = `${text} ${details || ''}`.trim();
    const rawTimeText = `${normalizeText(item?.time)} ${normalizeText(item?.dueTime)} ${combinedText}`;
    const daypartWindow = getStructuredDaypartWindow(item?.daypart) || getStructuredDaypartWindow(item?.timeWindow) || getPlanDaypartWindow(rawTimeText);
    const daypartHasExactTime = hasExplicitClockTime(rawTimeText);
    const cleanedText = daypartWindow ? cleanDaypartText(text) || text : text;
    const start = parseIsoInput(item?.start);
    const end = parseIsoInput(item?.end);
    const location = normalizeText(item?.location) || undefined;
    const explicitType = item?.type === 'event' || item?.type === 'task' || item?.type === 'buffer' ? item.type : undefined;

    if (explicitType === 'buffer') {
      const durationMinutes = getTimelineDurationMinutes(item, 'task', start, end);
      const bufferStart = start;
      const bufferEnd = end || (bufferStart ? new Date(new Date(bufferStart).getTime() + durationMinutes * 60_000).toISOString() : undefined);
      timelineItems.push({
        id: `draft-buffer-${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) || 'item'}`,
        kind: 'buffer',
        source: 'draft',
        title: cleanedText,
        start: bufferStart,
        end: bufferEnd,
        durationMinutes,
        timeSource: normalizePlanTimeSource(item?.timeSource) || (bufferStart ? 'ai' : 'none'),
        hidden: true,
      });
      return;
    }

    const isCalendarItem = explicitType === 'event'
      ? true
      : explicitType === 'task'
        ? false
        : (!!start || !!end) || EVENT_LIKE_RE.test(combinedText);

    if (isCalendarItem) {
      const calendarItem = resolvePlanCalendarItem({ date, item, text: cleanedText, details, start, end, location });
      const originalTimeSource = normalizePlanTimeSource(item?.timeSource);
      const shouldApplyDaypart = !!daypartWindow && !daypartHasExactTime && (!calendarItem.start || !isInDaypartWindow(calendarItem.start, daypartWindow));
      if (daypartWindow && shouldApplyDaypart) {
        calendarItem.start = applyDaypartStart(date, daypartWindow.startHour);
        calendarItem.end = new Date(new Date(calendarItem.start).getTime() + getTimelineDurationMinutes(item, 'event') * 60_000).toISOString();
      }
      const timeSource = shouldApplyDaypart
        ? 'ai'
        : originalTimeSource || (calendarItem.start ? 'user' : 'none');
      calendarItems.push(calendarItem);
      timelineItems.push({
        id: `draft-event-${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) || 'item'}`,
        kind: 'event',
        source: 'draft',
        title: calendarItem.title,
        start: calendarItem.start,
        end: calendarItem.end,
        durationMinutes: getTimelineDurationMinutes(item, 'event', calendarItem.start, calendarItem.end),
        timeSource,
        location: calendarItem.location,
      });
      return;
    }

    const priority = normalizePriority(item?.priority, combinedText);
    const todo = resolvePlanTodo({ date, item, text: cleanedText, details, start });
    const originalTimeSource = normalizePlanTimeSource(item?.timeSource);
    const shouldApplyDaypart = !!daypartWindow && !daypartHasExactTime && (!todo.hasDueTime || !isInDaypartWindow(todo.dueDate, daypartWindow));
    if (daypartWindow && shouldApplyDaypart) {
      todo.dueDate = applyDaypartStart(date, daypartWindow.startHour);
      todo.hasDueTime = true;
    }
    const todoItem = {
      text: todo.text,
      dueDate: todo.dueDate,
      hasDueTime: todo.hasDueTime,
      starred: priority === 'high',
      priority,
      durationMinutes: getTimelineDurationMinutes(item, 'task', todo.dueDate),
    };
    const timeSource = shouldApplyDaypart
      ? 'ai'
      : originalTimeSource || (todo.hasDueTime ? 'user' : 'none');
    todoItems.push(todoItem);
    timelineItems.push({
      id: `draft-task-${index}-${todo.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) || 'item'}`,
      kind: 'task',
      source: 'draft',
      title: todo.text,
      dueDate: todo.dueDate,
      hasDueTime: todo.hasDueTime,
      durationMinutes: getTimelineDurationMinutes(item, 'task', todo.dueDate),
      timeSource,
      priority,
      starred: priority === 'high',
    });
  });

  if (previousPlan?.date === date && previousCalendarItems.length === calendarItems.length) {
    for (let index = 0; index < calendarItems.length; index += 1) {
      const previousItem = previousCalendarItems[index];
      const nextItem = calendarItems[index];
      if (!previousItem || !nextItem) continue;

      if (!nextItem.start && previousItem.start) {
        nextItem.start = previousItem.start;
      }

      if (!nextItem.end) {
        if (nextItem.start === previousItem.start && previousItem.end) {
          nextItem.end = previousItem.end;
        } else if (nextItem.start && previousItem.start && previousItem.end) {
          const previousDuration = new Date(previousItem.end).getTime() - new Date(previousItem.start).getTime();
          const duration = previousDuration > 0 ? previousDuration : DEFAULT_EVENT_DURATION_MS;
          nextItem.end = new Date(new Date(nextItem.start).getTime() + duration).toISOString();
        } else if (previousItem.end) {
          nextItem.end = previousItem.end;
        }
      }
    }
  }

  if (previousPlan?.date === date && previousTodoItems.length === todoItems.length) {
    for (let index = 0; index < todoItems.length; index += 1) {
      const previousItem = previousTodoItems[index];
      const nextItem = todoItems[index];
      if (!previousItem?.hasDueTime || !nextItem || nextItem.hasDueTime) continue;
      nextItem.dueDate = previousItem.dueDate;
      nextItem.hasDueTime = true;
    }
  }

  let calendarIndex = 0;
  let todoIndex = 0;
  timelineItems = timelineItems.map((item) => {
    if (item.source !== 'draft') return item;
    if (item.kind === 'event') {
      const calendarItem = calendarItems[calendarIndex++];
      return {
        ...item,
        start: calendarItem?.start,
        end: calendarItem?.end,
        timeSource: calendarItem?.start && item.timeSource === 'none' ? 'user' : item.timeSource,
      };
    }
    if (item.kind === 'task') {
      const todoItem = todoItems[todoIndex++];
      return {
        ...item,
        dueDate: todoItem?.dueDate || item.dueDate,
        hasDueTime: typeof todoItem?.hasDueTime === 'boolean' ? todoItem.hasDueTime : item.hasDueTime,
        durationMinutes: todoItem?.durationMinutes || item.durationMinutes,
        timeSource: todoItem?.hasDueTime && item.timeSource === 'none' ? 'user' : item.timeSource,
      };
    }
    return item;
  });

  const draftId = previousPlan?.draftId || `day-plan-${date}-${Date.now().toString(36)}`;
  const plannedTimeline = replanTimelineItems([...timelineItems, ...blockerItems], date, { assignUntimedTasks: true });
  return buildDayPlanCardValue(date, plannedTimeline, draftId);
};

const save_day_plan: ToolHandler = async () => {
  const plan = getLastDayPlan();
  if (!plan) {
    throw new Error('NO_DAY_PLAN');
  }

  const normalizedPlan = Array.isArray(plan.timelineItems)
    ? buildDayPlanCardValue(plan.date, plan.timelineItems, plan.draftId)
    : plan;
  const rawCalendarItems = Array.isArray(normalizedPlan.calendarItems) ? normalizedPlan.calendarItems : [];
  const rawTodoItems = Array.isArray(normalizedPlan.todoItems) ? normalizedPlan.todoItems : [];

  for (const item of rawCalendarItems) {
    if (!item?.start || !item?.end) {
      throw new Error('DAY_PLAN_TIME_REQUIRED');
    }
  }

  const calendarSavePromise = Promise.all(rawCalendarItems.map(async (item) => {
    const result = await createCalendarEvent({
      title: item.title,
      start: item.start,
      end: item.end,
      location: item.location,
      details: item.details,
    });

    return result?.item
      ? {
        id: String(result.item.id || ''),
        title: String(result.item.title || ''),
        startDate: String(result.item.startDate || item.start || ''),
        endDate: typeof result.item.endDate === 'string' ? result.item.endDate : item.end,
        source: (result.item.source as string) === 'google' ? 'google' : 'local',
        location: typeof result.item.location === 'string' ? result.item.location : item.location,
        details: typeof result.item.details === 'string' ? result.item.details : item.details,
      }
      : null;
  }));
  const todoSavePromise = createTodoItems(rawTodoItems, {
    classify: false,
    taskKindFallback: 'normal',
  });

  const [calendarSaveResults, todoResult] = await Promise.all([calendarSavePromise, todoSavePromise]);
  const createdCalendarItems = calendarSaveResults.filter(Boolean) as {
    id: string;
    title: string;
    startDate: string;
    endDate?: string;
    source: 'local' | 'google';
    location?: string;
    details?: string;
  }[];
  const createdTodoItems = Array.isArray(todoResult?.createdItems) ? todoResult.createdItems : [];
  classifyCreatedTodoItemsInBackground(rawTodoItems, createdTodoItems);

  if (createdCalendarItems.length) {
    setLastCalendarItems(createdCalendarItems);
    appendCreatedCalendarItems(createdCalendarItems);
  }

  if (createdTodoItems.length) {
    const trackedTodos = createdTodoItems.map((item: any) => ({
      id: String(item.id || ''),
      text: String(item.text || ''),
      dueDate: typeof item.dueDate === 'string' ? item.dueDate : null,
      hasDueTime: typeof item.hasDueTime === 'boolean' ? item.hasDueTime : undefined,
      completed: false,
      starred: typeof item.starred === 'boolean' ? item.starred : false,
      workspace: typeof item.workspace === 'string' ? item.workspace : undefined,
    }));
    setLastQueryItems(trackedTodos);
    appendCreatedTodoItems(trackedTodos);
  }

  return {
    saved: true,
    date: normalizedPlan.date,
    calendarItems: createdCalendarItems.map((item) => ({
      title: item.title,
      start: item.startDate,
      end: item.endDate,
      location: item.location,
    })),
    todoItems: createdTodoItems.map((item: any, index: number) => ({
      text: String(item.text || rawTodoItems[index]?.text || ''),
      dueDate: typeof item.dueDate === 'string' ? item.dueDate : String(rawTodoItems[index]?.dueDate || ''),
      hasDueTime: typeof item.hasDueTime === 'boolean' ? item.hasDueTime : !!rawTodoItems[index]?.hasDueTime,
      starred: typeof item.starred === 'boolean' ? item.starred : !!rawTodoItems[index]?.starred,
      priority: rawTodoItems[index]?.priority === 'low' || rawTodoItems[index]?.priority === 'medium' || rawTodoItems[index]?.priority === 'high'
        ? rawTodoItems[index].priority
        : 'medium',
      durationMinutes: normalizeDurationMinutes(item.plannedDurationMinutes) || normalizeDurationMinutes(rawTodoItems[index]?.durationMinutes) || undefined,
    })),
  };
};

async function fetchDayPlanCalendarBlockers(date: string): Promise<DayPlanTimelineItem[]> {
  const targetDate = parseCalendarDateValue(date) || new Date();
  const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
  const dayEndExclusive = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1, 0, 0, 0);
  const dayEnd = new Date(dayEndExclusive.getTime() - 1);

  const localPromise = database.collections
    .get<EventModel>('events')
    .query(
      Q.where('start_date', Q.lt(dayEndExclusive.getTime())),
      Q.where('end_date', Q.gt(dayStart.getTime()))
    )
    .fetch() as Promise<EventModel[]>;

  const todosPromise = database.collections
    .get<TodoModel>('todos')
    .query(Q.where('completed', false))
    .fetch() as Promise<TodoModel[]>;

  const [localEvents, googleEvents, todos] = await Promise.all([localPromise, fetchGoogleEventsRange(dayStart, dayEnd), todosPromise]);
  const byGoogleId: Record<string, any> = Object.create(null);
  for (const event of googleEvents) byGoogleId[event.id] = event;

  const blockers: DayPlanTimelineItem[] = [];
  for (const event of localEvents as any[]) {
    const googleEvent = event.googleEventId ? byGoogleId[event.googleEventId] : undefined;
    if (googleEvent?.isAllDay === true) continue;
    const start = toIso(googleEvent?.startDate || event.startDate);
    const end = toIso(googleEvent?.endDate || event.endDate);
    blockers.push({
      id: `existing-${event.id}`,
      kind: 'blocker',
      source: 'existing',
      title: String(googleEvent?.title || event.title || ''),
      start,
      end,
      durationMinutes: getTimelineDurationMinutes({}, 'event', start, end),
      timeSource: 'user',
      location: event.location || googleEvent?.location || undefined,
      details: event.details || googleEvent?.details || undefined,
    });
  }

  for (const event of googleEvents) {
    const matched = (localEvents as any[]).some((localEvent) => localEvent.googleEventId === event.id);
    if (matched || event.isAllDay) continue;
    const start = toIso(event.startDate);
    const end = toIso(event.endDate);
    blockers.push({
      id: `existing-google-${event.id}`,
      kind: 'blocker',
      source: 'existing',
      title: String(event.title || ''),
      start,
      end,
      durationMinutes: getTimelineDurationMinutes({}, 'event', start, end),
      timeSource: 'user',
      location: event.location || undefined,
    });
  }

  const timedTodos = (todos as TodoModel[])
    .filter((todo) => {
      if (!todo?.dueDate || !todo.hasDueTime) return false;
      if (!isSupportedTodoWorkspaceKey(todo.workspace) || todo.workspace === 'Wishlist') return false;
      const dueDate = new Date(todo.dueDate);
      return dueDate.getTime() >= dayStart.getTime() && dueDate.getTime() < dayEndExclusive.getTime();
    })
    .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime());
  const needsInferredDuration = timedTodos
    .filter((todo) => !normalizeDurationMinutes((todo as any).plannedDurationMinutes))
    .map((todo) => ({
      id: String(todo.id),
      text: String(todo.text || ''),
      dueDate: new Date(todo.dueDate || dayStart).toISOString(),
    }));
  const inferredDurations = await inferExistingTodoDurations(needsInferredDuration);

  for (const todo of timedTodos) {
    const startDate = new Date(todo.dueDate || dayStart);
    const durationMinutes = normalizeDurationMinutes((todo as any).plannedDurationMinutes)
      || inferredDurations.get(String(todo.id))
      || EXISTING_TODO_FALLBACK_DURATION_MINUTES;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
    blockers.push({
      id: `existing-todo-${todo.id}`,
      kind: 'blocker',
      source: 'existing',
      title: String(todo.text || ''),
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      durationMinutes,
      timeSource: 'user',
      hidden: true,
    });
  }

  return blockers;
}

async function inferExistingTodoDurations(
  todos: { id: string; text: string; dueDate: string }[]
): Promise<Map<string, number>> {
  if (!todos.length) return new Map();
  try {
    const response: any = await fetchWithTimeout(`${SERVER_URL}/ai/day-plan/todo-durations`, {
      method: 'POST',
      headers: await getAiRequestHeaders('dayPlanning'),
      body: JSON.stringify({
        todos,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }),
    });
    if (!response?.ok) return new Map();
    const json = await response.json().catch(() => null);
    const durations = Array.isArray(json?.durations) ? json.durations : [];
    const byId = new Map<string, number>();
    for (const item of durations) {
      const id = String(item?.id || '').trim();
      const duration = normalizeDurationMinutes(item?.durationMinutes);
      if (id && duration) byId.set(id, duration);
    }
    return byId;
  } catch {
    return new Map();
  }
}

async function fetchGoogleEventsRange(start: Date, end: Date) {
  const token = await withFallbackTimeout(Promise.resolve(getAccessTokenStatic()), DAY_PLAN_NETWORK_TIMEOUT_MS, null);
  if (!token) return [];
  const timeMin = start.toISOString();
  const timeMax = end.toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    timeMin
  )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
  try {
    const resp = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (!resp?.ok) return [];
    const data: any = await resp.json().catch(() => ({}));
    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    return items.map((item: any) => ({
      id: String(item.id),
      title: String(item.summary || ''),
      startDate: parseCalendarDateValue(item.start?.dateTime || item.start?.date) || new Date(),
      endDate: parseCalendarDateValue(item.end?.dateTime || item.end?.date) || new Date(),
      source: 'google' as const,
      location: typeof item.location === 'string' ? item.location : undefined,
      isAllDay: !!(item.start?.date && !item.start?.dateTime),
    }));
  } catch {
    return [];
  }
}

const daily_overview: ToolHandler = async (args: any) => {
  const dateArg = typeof args?.date === 'string' ? args.date : undefined;
  const now = new Date();
  let targetDate: Date;
  
  if (dateArg) {
    const parsed = new Date(dateArg);
    targetDate = isNaN(parsed.getTime()) ? now : parsed;
  } else {
    targetDate = now;
  }
  
  const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
  const dayEndExclusive = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1, 0, 0, 0);
  const dayEnd = new Date(dayEndExclusive.getTime() - 1);
  const dayStr = toLocalYmd(targetDate);

  const todosPromise = (async () => {
    const todos = database.collections.get<TodoModel>('todos');
    const rows = await todos.query().fetch();
    return rows
      .filter((row) => {
        if (row.completed) return false;
        if (!isSupportedTodoWorkspaceKey(row.workspace)) return false;
        if (row.workspace === 'Wishlist') return false;
        const d = row.dueDate ? new Date(row.dueDate) : null;
        if (!d) return false;
        return toLocalYmd(d) === dayStr;
      })
      .slice(0, 20)
      .map((row) => ({
        id: String(row.id),
        text: row.text,
        dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : null,
        completed: !!row.completed,
        starred: !!row.starred,
        workspace: row.workspace,
      }));
  })();

  const calendarPromise = (async () => {
    const localPromise = database.collections
      .get<EventModel>('events')
      .query(Q.where('start_date', Q.between(dayStart.getTime(), dayEnd.getTime())))
      .fetch() as Promise<EventModel[]>;

    const [localEvents, googleEvents] = await Promise.all([localPromise, fetchGoogleEventsRange(dayStart, dayEnd)]);

    const byGoogleId: Record<string, any> = Object.create(null);
    for (const ge of googleEvents) byGoogleId[ge.id] = ge;

    const items: {
      id: string;
      title: string;
      startDate: string;
      endDate: string;
      source: 'local' | 'google';
      location?: string;
      isAllDay?: boolean;
    }[] = [];

    for (const le of localEvents as any[]) {
      const ge = le.googleEventId ? byGoogleId[le.googleEventId] : undefined;
      items.push({
        id: String(le.id),
        title: String(ge?.title || le.title || ''),
        startDate: toIso(ge?.startDate || le.startDate),
        endDate: toIso(ge?.endDate || le.endDate),
        source: 'local',
        location: le.location || ge?.location || undefined,
        isAllDay: ge?.isAllDay === true,
      });
    }

    for (const ge of googleEvents) {
      const matched = (localEvents as any[]).some((le) => le.googleEventId === ge.id);
      if (matched) continue;
      items.push({
        id: String(ge.id),
        title: String(ge.title || ''),
        startDate: toIso(ge.startDate),
        endDate: toIso(ge.endDate),
        source: 'google',
        location: ge.location || undefined,
        isAllDay: ge.isAllDay === true,
      });
    }

    items.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    return items;
  })();

  const [todos, calendar] = await Promise.all([todosPromise, calendarPromise]);

  return {
    date: dayStr,
    todos,
    calendar,
  };
};

export const overviewToolHandlers: Record<string, ToolHandler> = {
  plan_my_day,
  save_day_plan,
  daily_overview,
};
