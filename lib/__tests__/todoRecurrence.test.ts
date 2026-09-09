import {
  getTodoRecurrenceExpectedDateKeys,
  getTodoRecurrenceLabel,
  getNextTodoRecurrenceDateKeyAfter,
  getTodoRecurrenceOccurrenceDate,
  normalizeTodoRecurrenceRule,
  serializeTodoSkippedDateKeys,
  startOfLocalDay,
} from '../todoRecurrence';

const localDate = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day);

const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const key = (year: number, month: number, day: number) =>
  startOfLocalDay(localDate(year, month, day)).getTime();

describe('todoRecurrence', () => {
  it('normalizes rules and labels presets/custom values', () => {
    expect(normalizeTodoRecurrenceRule({ interval: 1, unit: 'day' })).toEqual({ interval: 1, unit: 'day' });
    expect(normalizeTodoRecurrenceRule({ interval: 2.4, unit: 'week' })).toEqual({ interval: 2, unit: 'week' });
    expect(normalizeTodoRecurrenceRule({ interval: 0, unit: 'day' })).toBeNull();
    expect(normalizeTodoRecurrenceRule({ interval: 100, unit: 'day' })).toBeNull();
    expect(normalizeTodoRecurrenceRule({ interval: 2, unit: 'year' })).toBeNull();

    expect(getTodoRecurrenceLabel(null)).toBe('No repeat');
    expect(getTodoRecurrenceLabel({ interval: 1, unit: 'day' })).toBe('Daily');
    expect(getTodoRecurrenceLabel({ interval: 1, unit: 'week' })).toBe('Weekly');
    expect(getTodoRecurrenceLabel({ interval: 1, unit: 'month' })).toBe('Monthly');
    expect(getTodoRecurrenceLabel({ interval: 3, unit: 'week' })).toBe('Every 3 weeks');
  });

  it('calculates day and week interval occurrences from start date', () => {
    const startDate = localDate(2026, 5, 4);

    expect(ymd(getTodoRecurrenceOccurrenceDate({ startDate, interval: 2, unit: 'day' }, 3))).toBe('2026-05-10');
    expect(ymd(getTodoRecurrenceOccurrenceDate({ startDate, interval: 2, unit: 'week' }, 2))).toBe('2026-06-01');
  });

  it('keeps monthly anchor day and clamps invalid month days', () => {
    const startDate = localDate(2026, 1, 31);
    const series = { startDate, interval: 1, unit: 'month' as const, anchorDay: 31 };

    expect(ymd(getTodoRecurrenceOccurrenceDate(series, 0))).toBe('2026-01-31');
    expect(ymd(getTodoRecurrenceOccurrenceDate(series, 1))).toBe('2026-02-28');
    expect(ymd(getTodoRecurrenceOccurrenceDate(series, 2))).toBe('2026-03-31');
  });

  it('generates only last 31 missed/current days plus one next future', () => {
    const keys = getTodoRecurrenceExpectedDateKeys(
      { startDate: localDate(2026, 1, 1), interval: 1, unit: 'day' },
      localDate(2026, 5, 31)
    );

    expect(keys).toHaveLength(32);
    expect(keys[0]).toBe(key(2026, 5, 1));
    expect(keys[30]).toBe(key(2026, 5, 31));
    expect(keys[31]).toBe(key(2026, 6, 1));
  });

  it('skips deleted occurrence dates and still finds one next future', () => {
    const skippedDatesJson = serializeTodoSkippedDateKeys(new Set([
      key(2026, 5, 30),
      key(2026, 6, 1),
    ]));

    const keys = getTodoRecurrenceExpectedDateKeys(
      { startDate: localDate(2026, 5, 29), interval: 1, unit: 'day', skippedDatesJson },
      localDate(2026, 5, 31)
    );

    expect(keys).toEqual([
      key(2026, 5, 29),
      key(2026, 5, 31),
      key(2026, 6, 2),
    ]);
  });

  it('finds next future date after a completed future occurrence', () => {
    const skippedDatesJson = serializeTodoSkippedDateKeys(new Set([
      key(2026, 6, 2),
    ]));

    expect(getNextTodoRecurrenceDateKeyAfter(
      { startDate: localDate(2026, 5, 31), interval: 1, unit: 'day', skippedDatesJson },
      key(2026, 6, 1)
    )).toBe(key(2026, 6, 3));
  });
});
