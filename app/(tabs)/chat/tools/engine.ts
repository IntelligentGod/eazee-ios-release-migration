import { getToolHandler } from '.';
import { presentTodoResult, presentCalendarResult, presentGoogleResult, presentGuidanceResult, presentAppNavigationResult } from './presenters';
import { getLastDayPlan, removeCreatedCalendarItems, removeLastCalendarItems, setLastDayPlan, setLastCalendarItems, setLastQueryItems } from './memory';
import type { ExecuteResult, ToolCall } from './types';

type ExecuteToolDeps = {
  serverUrl: string;
  router?: any;
  requestText?: string;
  renameChatTitle?: (title: string) => Promise<{ title: string }>;
};

const getLocalTodayYmd = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export async function executeToolCall(
  call: ToolCall,
  deps: ExecuteToolDeps
): Promise<ExecuteResult> {
  const name = String(call?.name || '');
  const args = call?.arguments;
  let success = true;
  let result: any = null;
  let error: string | undefined = undefined;
  try {
    if (name === 'chat_rename') {
      const title = typeof args?.title === 'string' ? String(args.title).trim() : '';
      if (!title || !deps.renameChatTitle) {
        success = false; error = 'CHAT_RENAME_UNAVAILABLE';
      } else {
        result = await deps.renameChatTitle(title);
      }
    } else {
      const handler = getToolHandler(name);
      if (!handler) {
        success = false; error = `Unknown tool: ${name}`;
      } else {
        const handlerArgs = name === 'app_open_screen'
          ? { ...(args && typeof args === 'object' ? args : {}), requestText: deps.requestText || '' }
          : args;
        result = await handler(handlerArgs);
      }
    }
  } catch (e: any) {
    success = false; error = String(e?.message || e || 'Tool execution failed');
    if (name === 'save_day_plan' && error !== 'DAY_PLAN_TIME_REQUIRED') {
      setLastDayPlan(null);
    }
    if (name === 'calendar_get_details' && error === 'EVENT_NOT_FOUND') {
      const source = args?.source === 'google' ? 'google' as const : 'local' as const;
      const staleItem = [{ id: String(args?.id || ''), source }];
      removeLastCalendarItems(staleItem);
      removeCreatedCalendarItems(staleItem);
    }
  }

  // Present results into chat-friendly messages/cards and optional navigation actions
  let messages: ExecuteResult['messages'] = [];
  let uiActions: ExecuteResult['uiActions'] = undefined;
  try {
    if (success) {
      if (name === 'chat_rename') {
        const title = String(result?.title || '').trim();
        messages = [{
          role: 'assistant',
          content: title ? `Renamed this chat to ${title}.` : 'Renamed this chat.',
        }];
      } else if (name === 'app_open_screen') {
        const pres = presentAppNavigationResult(name, result);
        messages = pres.messages || [];
        uiActions = pres.uiActions;
      } else if (name.startsWith('goal_') || name.startsWith('guidance_')) {
        const pres = presentGuidanceResult(name, result);
        messages = pres.messages || [];
      } else if (name.startsWith('google_')) {
        const pres = presentGoogleResult(name, result);
        messages = pres.messages || [];
        uiActions = pres.uiActions;
      } else if (name.startsWith('todo_') || name.startsWith('todo.') || name.includes('todo')) {
        const pres = presentTodoResult(name, result);
        messages = pres.messages || [];
      } else if (name.startsWith('calendar_')) {
        const pres = presentCalendarResult(name, result);
        messages = pres.messages || [];
        uiActions = pres.uiActions;
      } else if (name === 'plan_my_day') {
        const date = typeof result?.date === 'string' ? result.date : new Date().toISOString().slice(0, 10);
        const draftId = typeof result?.draftId === 'string' ? result.draftId : undefined;
        const calendarItems = Array.isArray(result?.calendarItems) ? result.calendarItems : [];
        const todoItems = Array.isArray(result?.todoItems) ? result.todoItems : [];
        const timelineItems = Array.isArray(result?.timelineItems) ? result.timelineItems : undefined;
        const saveBlockedReason = typeof result?.saveBlockedReason === 'string' ? result.saveBlockedReason : undefined;
        const card = { type: 'dayPlan', draftId, date, calendarItems, todoItems, timelineItems, saveBlockedReason };
        setLastDayPlan({ draftId, date, calendarItems, todoItems, timelineItems, saveBlockedReason });
        messages = [
          {
            role: 'assistant',
            content: "Here's your plan. Say 'looks good' to save it, or reply with edits.",
          },
          {
            role: 'assistant',
            content: '',
            card,
          },
        ];
      } else if (name === 'save_day_plan') {
        const savedPlan = getLastDayPlan();
        const shouldShowHomeShortcut = savedPlan?.date === getLocalTodayYmd();
        setLastDayPlan(null);
        messages = [
          {
            role: 'assistant',
            content: 'Added to your schedule.',
          },
          ...(shouldShowHomeShortcut
            ? [{
                role: 'assistant' as const,
                content: '',
                card: {
                  type: 'navigationShortcut',
                  label: "today's schedule (home)",
                  route: '/(tabs)/home',
                  params: {},
                },
              }]
            : []),
        ];
      } else if (name === 'daily_overview') {
        const date = result?.date || new Date().toISOString().slice(0, 10);
        const todos = Array.isArray(result?.todos) ? result.todos : [];
        const calendar = Array.isArray(result?.calendar) ? result.calendar : [];
        if (calendar.length) {
          setLastCalendarItems(calendar);
        }
        if (todos.length) {
          setLastQueryItems(todos);
        }
        messages = [
          {
            role: 'assistant',
            content: "Here's your overview.",
          },
          {
            role: 'assistant',
            content: '',
            card: { type: 'dailyOverview', date, todos, calendar },
          },
        ];
      } else {
        messages = [{ role: 'assistant', content: 'Done.' }];
      }
    } else {
      if (name === 'calendar_get_details' && error === 'EVENT_NOT_FOUND') {
        messages = [{ role: 'assistant', content: 'That event no longer exists.' }];
      } else if (name === 'save_day_plan' && error === 'DAY_PLAN_TIME_REQUIRED') {
        messages = [{ role: 'assistant', content: 'Set a time for every event before saving this plan.' }];
      } else if (name.startsWith('calendar_') && error === 'GOOGLE_AUTH_REQUIRED') {
        messages = [{ role: 'assistant', content: 'Google Calendar needs to be reconnected.' }];
      } else {
        messages = [{ role: 'assistant', content: 'Something went wrong while I was doing that.' }];
      }
    }
  } catch {
    // If presenter fails, still return a generic message
    if (success) messages = [{ role: 'assistant', content: 'Done.' }];
    else if (name === 'calendar_get_details' && error === 'EVENT_NOT_FOUND') messages = [{ role: 'assistant', content: 'That event no longer exists.' }];
    else if (name === 'save_day_plan' && error === 'DAY_PLAN_TIME_REQUIRED') messages = [{ role: 'assistant', content: 'Set a time for every event before saving this plan.' }];
    else messages = [{ role: 'assistant', content: 'Something went wrong while I was doing that.' }];
  }

  return { success, messages, uiActions, error, result };
}
