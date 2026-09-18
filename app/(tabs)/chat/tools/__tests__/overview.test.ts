// These suites cover feature behaviour, not billing: run them as an entitled
// user so the Pro gate in lib/aiRequest does not short-circuit the requests.
jest.mock('@/lib/subscriptionUsage', () => ({
  ...jest.requireActual('@/lib/subscriptionUsage'),
  checkAiFeatureAccess: jest.fn(async () => ({ allowed: true })),
  recordAiAction: jest.fn(async () => {}),
  recordVoiceUsage: jest.fn(async () => {}),
}));
jest.mock('../../../../../database/database', () => ({
  database: {
    collections: {
      get: jest.fn(() => ({
        query: jest.fn(() => ({
          fetch: jest.fn(async () => []),
        })),
      })),
    },
    write: jest.fn(),
  },
}));

jest.mock('@/lib/todoMutations', () => ({
  createTodos: jest.fn(async (inputs: any[]) =>
    (Array.isArray(inputs) ? inputs : []).map((input, index) => ({
      todo: {
        id: `todo-${index + 1}`,
        text: input.text,
        dueDate: input.dueDate,
        hasDueTime: input.hasDueTime,
        workspace: input.workspace,
        starred: input.starred,
        plannedDurationMinutes: input.plannedDurationMinutes,
      },
    }))
  ),
  deleteTodos: jest.fn(async () => []),
  updateTodos: jest.fn(async () => []),
}));

jest.mock('@/lib/todoClassification', () => ({
  requestTodoClassification: jest.fn(async () => ({ kind: 'normal', confidence: 1 })),
  shouldClassifyTodoWorkspace: jest.fn((workspace?: string | null) =>
    workspace === 'Personal' || workspace === 'Goals'
  ),
}));

jest.mock('@/app/context/TokenContext', () => ({
  getAccessTokenStatic: jest.fn(async () => null),
  getGoogleConnectionStatusStatic: jest.fn(async () => ({ isActive: false, accessToken: null })),
}));

jest.mock('@/firebaseConfig', () => ({
  auth: {
    currentUser: {
      uid: 'user-1',
      getIdToken: jest.fn(async () => 'token-1'),
    },
  },
}));

jest.mock('@/lib/aiDataSharingConsent', () => ({
  requireAiDataSharingConsent: jest.fn(async () => {}),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(async () => undefined),
  multiGet: jest.fn(async () => []),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { overviewToolHandlers } = require('../overview');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { executeToolCall } = require('../engine');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setLastDayPlan } = require('../memory');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getAccessTokenStatic } = require('@/app/context/TokenContext');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { database } = require('../../../../../database/database');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createTodos, updateTodos } = require('@/lib/todoMutations');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { requestTodoClassification } = require('@/lib/todoClassification');

describe('plan_my_day', () => {
  beforeEach(() => {
    getAccessTokenStatic.mockReset();
    getAccessTokenStatic.mockResolvedValue(null);
    global.fetch = jest.fn();
    database.collections.get.mockReset();
    database.collections.get.mockImplementation(() => ({
      query: jest.fn(() => ({
        fetch: jest.fn(async () => []),
      })),
    }));
    createTodos.mockClear();
    updateTodos.mockClear();
    requestTodoClassification.mockClear();
  });

  afterEach(() => {
    setLastDayPlan(null);
  });

  it('keeps timed tasks as timed todos when the time is in the text', async () => {
    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [{ type: 'task', text: 'Finish report at 3 pm' }],
    });

    expect(result.calendarItems).toHaveLength(0);
    expect(result.todoItems).toHaveLength(1);
    expect(result.todoItems[0]).toMatchObject({
      text: 'Finish report',
      hasDueTime: true,
    });
    const dueDate = new Date(result.todoItems[0].dueDate);
    expect(dueDate.getHours()).toBe(15);
    expect(dueDate.getMinutes()).toBe(0);
  });

  it('keeps a task start time as the todo due time', async () => {
    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [
        {
          type: 'task',
          text: 'Ship build',
          start: '2026-03-18T18:30:00+05:30',
        },
      ],
    });

    expect(result.calendarItems).toHaveLength(0);
    expect(result.todoItems[0]).toMatchObject({
      text: 'Ship build',
      hasDueTime: true,
    });
    const dueDate = new Date(result.todoItems[0].dueDate);
    expect(dueDate.getHours()).toBe(18);
    expect(dueDate.getMinutes()).toBe(30);
  });

  it('keeps an explicit task out of calendar even with event-like wording', async () => {
    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [{ type: 'task', text: 'Call Alex at 3 pm' }],
    });

    expect(result.calendarItems).toHaveLength(0);
    expect(result.todoItems).toHaveLength(1);
    expect(result.todoItems[0]).toMatchObject({
      text: 'Call Alex',
      hasDueTime: true,
    });
  });

  it('parses event time from the title and keeps it out of the title text', async () => {
    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [{ text: 'Meeting at 9 am' }],
    });

    expect(result.todoItems).toHaveLength(0);
    expect(result.calendarItems).toHaveLength(1);
    expect(result.calendarItems[0]).toMatchObject({
      title: 'Meeting',
    });

    const startDate = new Date(result.calendarItems[0].start);
    const endDate = new Date(result.calendarItems[0].end);
    expect(startDate.getHours()).toBe(9);
    expect(startDate.getMinutes()).toBe(0);
    expect(endDate.getHours()).toBe(10);
    expect(endDate.getMinutes()).toBe(0);
  });

  it('parses event time ranges from text-only event items', async () => {
    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [{ text: 'Hospital visit 2 pm - 3:30 pm' }],
    });

    expect(result.todoItems).toHaveLength(0);
    expect(result.calendarItems[0]).toMatchObject({
      title: 'Hospital visit',
    });

    const startDate = new Date(result.calendarItems[0].start);
    const endDate = new Date(result.calendarItems[0].end);
    expect(startDate.getHours()).toBe(14);
    expect(startDate.getMinutes()).toBe(0);
    expect(endDate.getHours()).toBe(15);
    expect(endDate.getMinutes()).toBe(30);
  });

  it('preserves existing event timing when only the title changes', async () => {
    setLastDayPlan({
      date: '2026-03-18',
      calendarItems: [
        {
          title: 'Meeting',
          start: '2026-03-18T09:00:00+05:30',
          end: '2026-03-18T10:00:00+05:30',
        },
      ],
      todoItems: [],
    });

    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [{ type: 'event', text: 'Team sync' }],
    });

    expect(result.calendarItems[0]).toMatchObject({
      title: 'Team sync',
      start: '2026-03-18T09:00:00+05:30',
      end: '2026-03-18T10:00:00+05:30',
    });
  });

  it('preserves existing timed todos when only the title changes', async () => {
    setLastDayPlan({
      date: '2026-03-18',
      calendarItems: [],
      todoItems: [
        {
          text: 'Finish report',
          dueDate: '2026-03-18T15:00:00+05:30',
          hasDueTime: true,
          priority: 'high',
          starred: true,
        },
      ],
    });

    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [{ type: 'task', text: 'Ship report' }],
    });

    expect(result.todoItems[0]).toMatchObject({
      text: 'Ship report',
      dueDate: '2026-03-18T15:00:00+05:30',
      hasDueTime: true,
    });
  });

  it('does not carry generated details into day plan cards', async () => {
    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [
        { type: 'task', text: 'Write proposal', details: 'Draft outline and send it to the team' },
        { type: 'event', text: 'Design review', start: '2026-03-18T14:00:00+05:30', details: 'Discuss mocks and next steps' },
      ],
    });

    expect(result.todoItems[0]?.details).toBeUndefined();
    expect(result.calendarItems[0]?.details).toBeUndefined();
    expect(result.timelineItems.find((item: any) => item.kind === 'task')?.details).toBeUndefined();
    expect(result.timelineItems.find((item: any) => item.kind === 'event')?.details).toBeUndefined();
  });

  it('uses AI-provided order instead of the typed item order', async () => {
    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [
        { type: 'task', text: 'Reply to emails', order: 3, durationMinutes: 30, timeSource: 'none' },
        { type: 'task', text: 'Deep work', order: 1, durationMinutes: 90, timeSource: 'none' },
        { type: 'task', text: 'Quick admin', order: 2, durationMinutes: 30, timeSource: 'none' },
      ],
    });

    const draftTitles = result.timelineItems
      .filter((item: any) => item.source === 'draft')
      .map((item: any) => item.title);

    expect(draftTitles).toEqual(['Deep work', 'Quick admin', 'Reply to emails']);
  });

  it('keeps vague night requests in a night slot', async () => {
    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [{ type: 'task', text: 'Read in the night', durationMinutes: 45, timeSource: 'none' }],
    });

    const dueDate = new Date(result.todoItems[0]?.dueDate);

    expect(result.todoItems[0]).toMatchObject({
      text: 'Read',
      hasDueTime: true,
    });
    expect(dueDate.getHours()).toBe(19);
  });

  it('corrects AI-picked afternoon times when the text says night', async () => {
    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [{
        type: 'task',
        text: 'Read in the night',
        dueDate: '2026-03-18T15:30:00+05:30',
        hasDueTime: true,
        durationMinutes: 45,
        timeSource: 'ai',
      }],
    });

    const dueDate = new Date(result.todoItems[0]?.dueDate);

    expect(dueDate.getHours()).toBe(19);
  });

  it('keeps structured night dayparts even when the title was cleaned', async () => {
    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [{
        type: 'task',
        text: 'Read',
        daypart: 'night',
        dueDate: '2026-03-18T16:15:00+05:30',
        hasDueTime: true,
        durationMinutes: 45,
        timeSource: 'ai',
      }],
    });

    const dueDate = new Date(result.todoItems[0]?.dueDate);

    expect(result.todoItems[0]?.text).toBe('Read');
    expect(dueDate.getHours()).toBe(19);
    expect(dueDate.getMinutes()).toBe(0);
  });

  it('moves AI-timed items away from existing calendar blockers', async () => {
    database.collections.get.mockImplementation(() => ({
      query: jest.fn(() => ({
        fetch: jest.fn(async () => [
          {
            id: 'lunch',
            title: 'Lunch',
            startDate: new Date('2026-03-18T12:00:00+05:30'),
            endDate: new Date('2026-03-18T13:00:00+05:30'),
          },
        ]),
      })),
    }));

    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [
        {
          type: 'event',
          text: 'Design review',
          start: '2026-03-18T12:00:00+05:30',
          end: '2026-03-18T13:00:00+05:30',
          durationMinutes: 60,
          timeSource: 'ai',
        },
      ],
    });

    const draftEvent = result.timelineItems.find((item: any) => item.source === 'draft' && item.kind === 'event');
    const startDate = new Date(draftEvent?.start);

    expect(draftEvent?.timeSource).toBe('ai');
    expect(startDate.getHours()).toBe(13);
    expect(startDate.getMinutes()).toBe(0);
  });

  it('queries local calendar blockers by day overlap', async () => {
    const eventsQuery = jest.fn(() => ({
      fetch: jest.fn(async () => []),
    }));
    const todosQuery = jest.fn(() => ({
      fetch: jest.fn(async () => []),
    }));
    database.collections.get.mockImplementation((table: string) => ({
      query: table === 'events' ? eventsQuery : todosQuery,
    }));

    await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [{ type: 'task', text: 'Write proposal', durationMinutes: 60, timeSource: 'none' }],
    });

    expect(eventsQuery).toHaveBeenCalledTimes(1);
    expect(eventsQuery.mock.calls[0]).toHaveLength(2);
  });

  it('uses hidden buffers to move later items without saving the buffer', async () => {
    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [
        {
          type: 'event',
          text: 'Client meeting',
          start: '2026-03-18T10:00:00+05:30',
          end: '2026-03-18T11:00:00+05:30',
          timeSource: 'user',
          order: 1,
        },
        {
          type: 'buffer',
          text: 'Transition time',
          durationMinutes: 30,
          timeSource: 'none',
          order: 2,
        },
        {
          type: 'event',
          text: 'Design review',
          start: '2026-03-18T11:00:00+05:30',
          end: '2026-03-18T12:00:00+05:30',
          timeSource: 'ai',
          order: 3,
        },
      ],
    });

    const hiddenBuffer = result.timelineItems.find((item: any) => item.kind === 'buffer');
    const designReview = result.calendarItems.find((item: any) => item.title === 'Design review');

    expect(hiddenBuffer).toMatchObject({
      hidden: true,
      durationMinutes: 30,
    });
    expect(result.todoItems.map((item: any) => item.text)).not.toContain('Transition time');
    expect(result.calendarItems.map((item: any) => item.title)).not.toContain('Transition time');
    expect(new Date(designReview?.start).getHours()).toBe(11);
    expect(new Date(designReview?.start).getMinutes()).toBe(30);
  });

  it('does not use synced all-day Google events as day-plan blockers', async () => {
    getAccessTokenStatic.mockResolvedValue('token-123');
    database.collections.get.mockImplementation(() => ({
      query: jest.fn(() => ({
        fetch: jest.fn(async () => [
          {
            id: 'local-holiday',
            googleEventId: 'google-holiday',
            title: 'Holiday',
            startDate: new Date('2026-03-18T00:00:00+05:30'),
            endDate: new Date('2026-03-19T00:00:00+05:30'),
          },
        ]),
      })),
    }));
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'google-holiday',
            summary: 'Holiday',
            start: { date: '2026-03-18' },
            end: { date: '2026-03-19' },
          },
        ],
      }),
    });

    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [{ type: 'task', text: 'Write proposal', durationMinutes: 60, timeSource: 'none' }],
    });

    expect(result.timelineItems.some((item: any) => item.source === 'existing')).toBe(false);
    expect(new Date(result.todoItems[0]?.dueDate).getHours()).toBe(9);
  });

  it('uses existing timed todos as hidden blockers with inferred durations', async () => {
    database.collections.get.mockImplementation((table: string) => ({
      query: jest.fn(() => ({
        fetch: jest.fn(async () => table === 'todos'
          ? [
            {
              id: 'deep-work',
              text: 'Deep work',
              dueDate: new Date('2026-03-18T10:00:00+05:30'),
              hasDueTime: true,
              completed: false,
              workspace: 'Personal',
            },
          ]
          : []),
      })),
    }));
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        durations: [{ id: 'deep-work', durationMinutes: 120 }],
      }),
    });

    const result = await overviewToolHandlers.plan_my_day({
      date: '2026-03-18',
      items: [{ type: 'event', text: 'Design review', start: '2026-03-18T10:30:00+05:30', end: '2026-03-18T11:00:00+05:30', timeSource: 'ai' }],
    });

    const hiddenTodoBlocker = result.timelineItems.find((item: any) => item.id === 'existing-todo-deep-work');
    const draftEvent = result.timelineItems.find((item: any) => item.source === 'draft');

    expect(hiddenTodoBlocker).toMatchObject({ hidden: true, durationMinutes: 120 });
    expect(new Date(draftEvent?.start).getHours()).toBe(12);
  });

  it('shows the plan as a text bubble followed by a day-plan card', async () => {
    const result = await executeToolCall(
      {
        name: 'plan_my_day',
        arguments: {
          date: '2026-03-18',
          items: [{ type: 'task', text: 'Finish report at 3 pm', priority: 'high' }],
        },
      },
      { serverUrl: 'http://localhost' }
    );

    expect(result.success).toBe(true);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      role: 'assistant',
      content: "Here's your plan. Say 'looks good' to save it, or reply with edits.",
    });
    expect(result.messages[1]?.content).toBe('');
    expect(result.messages[1]?.card).toMatchObject({
      type: 'dayPlan',
      date: '2026-03-18',
    });
    expect(result.messages[1]?.card?.todoItems?.[0]).toMatchObject({
      text: 'Finish report',
      priority: 'high',
      hasDueTime: true,
    });
  });

  it('saves a confirmed plan before classifying todos in the background', async () => {
    jest.useFakeTimers();
    try {
      setLastDayPlan({
        date: '2026-03-18',
        calendarItems: [],
        todoItems: [
          {
            text: 'Finish report',
            dueDate: '2026-03-18T15:00:00+05:30',
            hasDueTime: true,
            priority: 'high',
            starred: true,
            durationMinutes: 90,
          },
        ],
      });

      const result = await executeToolCall(
        {
          name: 'save_day_plan',
          arguments: {},
        },
        { serverUrl: 'http://localhost' }
      );

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toMatchObject({
        role: 'assistant',
        content: 'Added to your schedule.',
      });
      expect(result.messages[0]?.card).toBeUndefined();
      expect(requestTodoClassification).not.toHaveBeenCalled();
      expect(createTodos.mock.calls[0]?.[0]?.[0]).toMatchObject({
        text: 'Finish report',
        taskKind: 'normal',
        plannedDurationMinutes: 90,
      });

      jest.runOnlyPendingTimers();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(requestTodoClassification).toHaveBeenCalledWith({
        title: 'Finish report',
        details: '',
        workspace: 'Personal',
      });
      expect(updateTodos).toHaveBeenCalledWith([{
        id: 'todo-1',
        input: { taskKind: 'normal' },
        options: { syncReminder: false },
      }]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows a Home shortcut after saving a plan for today', async () => {
    const today = new Date();
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    setLastDayPlan({
      date: todayYmd,
      calendarItems: [],
      todoItems: [],
    });

    const result = await executeToolCall(
      {
        name: 'save_day_plan',
        arguments: {},
      },
      { serverUrl: 'http://localhost' }
    );

    expect(result.success).toBe(true);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      role: 'assistant',
      content: 'Added to your schedule.',
    });
    expect(result.messages[1]).toMatchObject({
      role: 'assistant',
      content: '',
      card: {
        type: 'navigationShortcut',
        label: "today's schedule (home)",
        route: '/(tabs)/home',
        params: {},
      },
    });
  });

  it('excludes wishlist items from daily overview tasks', async () => {
    const rows = [
      {
        id: 'todo-personal',
        text: 'Finish report',
        dueDate: '2026-03-18T10:00:00+05:30',
        completed: false,
        starred: false,
        workspace: 'Personal',
      },
      {
        id: 'todo-wishlist',
        text: 'Buy headphones',
        dueDate: '2026-03-18T11:00:00+05:30',
        completed: false,
        starred: false,
        workspace: 'Wishlist',
      },
    ];

    database.collections.get.mockImplementation((collectionName: string) => ({
      query: jest.fn(() => ({
        fetch: jest.fn(async () => (collectionName === 'todos' ? rows : [])),
      })),
    }));

    const result = await overviewToolHandlers.daily_overview({ date: '2026-03-18' });

    expect(result.todos.map((todo: any) => todo.id)).toEqual(['todo-personal']);
  });

});
