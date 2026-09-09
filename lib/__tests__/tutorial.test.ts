import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TUTORIAL_CALENDAR_EVENT_STEP,
  TUTORIAL_CHAT_DAY_PLAN_STEP,
  TUTORIAL_GOAL_GUIDANCE_STEP,
  TUTORIAL_HOME_OVERVIEW_STEP,
  TUTORIAL_WISHLIST_SHOPPING_STEP,
  TUTORIAL_TODO_GUIDANCE_STEP,
  TUTORIAL_PROGRESS_KEY_PREFIX,
  completeTutorialStep,
  getTutorialReadingTimeMs,
  getTutorialProgress,
  isActiveTutorialStepPending,
  isTutorialDemoTodoReusable,
  isTutorialSessionActive,
  isTutorialComplete,
  isTutorialStepComplete,
  setTutorialGoalDemoTodoId,
  setTutorialTodoDemoTodoId,
  startTutorial,
} from '../tutorial';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('tutorial progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('treats missing progress as complete for existing users', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(isTutorialStepComplete('user-1', TUTORIAL_CHAT_DAY_PLAN_STEP)).resolves.toBe(true);
    await expect(isTutorialComplete('user-1')).resolves.toBe(true);
  });

  it('starts tutorial as pending for the user-specific key', async () => {
    mockedAsyncStorage.setItem.mockResolvedValue();

    expect(isTutorialSessionActive('user-2')).toBe(false);

    await startTutorial('user-2');

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      `${TUTORIAL_PROGRESS_KEY_PREFIX}:user-2`,
      JSON.stringify({ completedSteps: [] })
    );
    expect(isTutorialSessionActive('user-2')).toBe(true);
    expect(isActiveTutorialStepPending('user-2', TUTORIAL_CHAT_DAY_PLAN_STEP)).toBe(true);
  });

  it('marks the chat day plan step complete', async () => {
    mockedAsyncStorage.setItem.mockResolvedValue();
    await startTutorial('user-3');
    mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ completedSteps: [] }));
    mockedAsyncStorage.setItem.mockResolvedValue();

    await completeTutorialStep('user-3', TUTORIAL_CHAT_DAY_PLAN_STEP);

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      `${TUTORIAL_PROGRESS_KEY_PREFIX}:user-3`,
      JSON.stringify({ completedSteps: [TUTORIAL_CHAT_DAY_PLAN_STEP] })
    );
    expect(isActiveTutorialStepPending('user-3', TUTORIAL_CHAT_DAY_PLAN_STEP)).toBe(false);
    expect(isActiveTutorialStepPending('user-3', TUTORIAL_TODO_GUIDANCE_STEP)).toBe(true);
  });

  it('requires all tutorial steps before progress is complete', async () => {
    mockedAsyncStorage.getItem
      .mockResolvedValueOnce(JSON.stringify({ completedSteps: [TUTORIAL_CHAT_DAY_PLAN_STEP] }))
      .mockResolvedValueOnce(JSON.stringify({ completedSteps: [TUTORIAL_CHAT_DAY_PLAN_STEP] }))
      .mockResolvedValueOnce(JSON.stringify({
        completedSteps: [
          TUTORIAL_CHAT_DAY_PLAN_STEP,
          TUTORIAL_TODO_GUIDANCE_STEP,
          TUTORIAL_GOAL_GUIDANCE_STEP,
          TUTORIAL_CALENDAR_EVENT_STEP,
          TUTORIAL_HOME_OVERVIEW_STEP,
          TUTORIAL_WISHLIST_SHOPPING_STEP,
        ],
      }));

    await expect(getTutorialProgress('user-4')).resolves.toMatchObject({
      completedSteps: [TUTORIAL_CHAT_DAY_PLAN_STEP],
      hasStarted: true,
    });
    await expect(isTutorialComplete('user-4')).resolves.toBe(false);
    await expect(isTutorialComplete('user-4')).resolves.toBe(true);
  });

  it('stores tutorial demo todo id with existing step progress', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ completedSteps: [TUTORIAL_CHAT_DAY_PLAN_STEP] }));
    mockedAsyncStorage.setItem.mockResolvedValue();

    await setTutorialTodoDemoTodoId('user-5', 'todo-1');

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      `${TUTORIAL_PROGRESS_KEY_PREFIX}:user-5`,
      JSON.stringify({ completedSteps: [TUTORIAL_CHAT_DAY_PLAN_STEP], todoDemoTodoId: 'todo-1' })
    );
  });

  it('stores tutorial demo goal id with existing step progress', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
      completedSteps: [TUTORIAL_CHAT_DAY_PLAN_STEP, TUTORIAL_TODO_GUIDANCE_STEP],
      todoDemoTodoId: 'todo-1',
    }));
    mockedAsyncStorage.setItem.mockResolvedValue();

    await setTutorialGoalDemoTodoId('user-6', 'goal-1');

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      `${TUTORIAL_PROGRESS_KEY_PREFIX}:user-6`,
      JSON.stringify({
        completedSteps: [TUTORIAL_CHAT_DAY_PLAN_STEP, TUTORIAL_TODO_GUIDANCE_STEP],
        todoDemoTodoId: 'todo-1',
        goalDemoTodoId: 'goal-1',
      })
    );
  });

  it('only reuses fresh demo todos for tutorial replay', () => {
    expect(isTutorialDemoTodoReusable({ completed: false, guidancePath: null })).toBe(true);
    expect(isTutorialDemoTodoReusable({ completed: true, guidancePath: null })).toBe(false);
    expect(isTutorialDemoTodoReusable({ completed: false, guidancePath: 'actions' })).toBe(false);
    expect(isTutorialDemoTodoReusable({ completed: false, guidancePath: 'video' })).toBe(false);
  });

  it('allows more reading time for longer tutorial messages within sensible bounds', () => {
    expect(getTutorialReadingTimeMs('Read this.')).toBe(2800);
    expect(getTutorialReadingTimeMs('This message has enough words to take noticeably longer to read.')).toBeGreaterThan(2800);
    expect(getTutorialReadingTimeMs(Array.from({ length: 60 }, () => 'word').join(' '))).toBe(10000);
  });
});
