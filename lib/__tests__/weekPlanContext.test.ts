jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('@/app/context/TokenContext', () => ({ getAccessTokenStatic: jest.fn() }));
jest.mock('@/database/database', () => ({ database: {} }));

import { DEFAULT_LIFE_GRAPH_SETTINGS, computeLifeGraphProgress } from '@/lib/lifeGraph';
import { buildWeekPlanContext, getWeekPlanDates } from '@/lib/weekPlanContext';

// Wednesday; the week runs Mon Sep 28 to Sun Oct 4
const now = new Date(2026, 8, 30, 10);
const weekStart = new Date(2026, 8, 28);

describe('getWeekPlanDates', () => {
  it('plans from today through Sunday, skipping days already past', () => {
    expect(getWeekPlanDates(now, weekStart)).toEqual([
      '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ]);
    expect(getWeekPlanDates(new Date(2026, 8, 28, 8), weekStart)).toHaveLength(7);
  });
});

describe('buildWeekPlanContext', () => {
  const context = buildWeekPlanContext({
    now,
    weekStart,
    events: [{ id: 'e1', title: 'Team sync', startDate: new Date(2026, 9, 1, 14), endDate: new Date(2026, 9, 1, 15), isAllDay: false }],
    tasks: [
      { title: 'Pay rent', dueDate: new Date(2026, 8, 25), hasDueTime: false, isOverdue: true, starred: false },
      { title: 'Call mom', hasDueTime: false, isOverdue: false, starred: true },
    ],
    goals: [{ title: 'Run 10k' }],
    lifeGraph: DEFAULT_LIFE_GRAPH_SETTINGS,
    lifeGraphProgress: computeLifeGraphProgress(
      DEFAULT_LIFE_GRAPH_SETTINGS,
      [{ text: 'Gym', completedAt: new Date(2026, 8, 29) }],
      weekStart
    ),
  });

  it('asks questions first, then plans each remaining day, then asks about gaps', () => {
    expect(context).toContain('Do not call any tool yet');
    expect(context).toContain('call plan_my_day once for EACH of these dates, in order: 2026-09-30, 2026-10-01, 2026-10-02, 2026-10-03, 2026-10-04');
    expect(context).toContain('point out any remaining gaps');
  });

  it('includes events, tasks with their exact titles, goals, and life areas', () => {
    expect(context).toContain('Thu Oct 1 2:00 PM-3:00 PM: Team sync');
    expect(context).toContain('"Pay rent" (overdue since Fri Sep 25)');
    expect(context).toContain('"Call mom" (no date, starred)');
    expect(context).toContain('- "Run 10k"');
    expect(context).toContain('- Health: 1/5 (behind)');
  });
});
