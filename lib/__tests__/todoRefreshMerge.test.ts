import { isRefreshSuperseded, preservePendingToggles } from '@/lib/todoRefreshMerge';

type Todo = { id: string; completed: boolean; text?: string };

const todo = (id: string, completed: boolean, text = id): Todo => ({ id, completed, text });

describe('isRefreshSuperseded', () => {
  it('lets the newest refresh write', () => {
    expect(isRefreshSuperseded(3, 3)).toBe(false);
  });

  it('drops a refresh that a newer one started after', () => {
    expect(isRefreshSuperseded(2, 3)).toBe(true);
  });
});

describe('preservePendingToggles', () => {
  it('returns the refreshed rows untouched when nothing is mid-toggle', () => {
    const refreshed = [todo('a', false), todo('b', true)];

    expect(preservePendingToggles(refreshed, new Set(), [])).toBe(refreshed);
  });

  // The write has not landed yet, so the database still says incomplete. Taking
  // it at face value is what unticks the checkbox.
  it('keeps the optimistic completion for a todo whose write is in flight', () => {
    const refreshed = [todo('a', false), todo('b', false)];
    const previous = [todo('a', true), todo('b', false)];

    const merged = preservePendingToggles(refreshed, new Set(['a']), previous);

    expect(merged.find((t) => t.id === 'a')?.completed).toBe(true);
    expect(merged.find((t) => t.id === 'b')?.completed).toBe(false);
  });

  it('preserves un-completing just as well as completing', () => {
    const refreshed = [todo('a', true)];
    const previous = [todo('a', false)];

    expect(preservePendingToggles(refreshed, new Set(['a']), previous)[0].completed).toBe(false);
  });

  it('leaves todos alone once their toggle is no longer pending', () => {
    const refreshed = [todo('a', true)];
    const previous = [todo('a', false)];

    expect(preservePendingToggles(refreshed, new Set(['other']), previous)[0].completed).toBe(true);
  });

  it('takes the refreshed row for a pending todo it has never seen before', () => {
    const refreshed = [todo('new', true)];

    expect(preservePendingToggles(refreshed, new Set(['new']), [])[0].completed).toBe(true);
  });

  it('keeps every other field from the refreshed row, not the stale one', () => {
    const refreshed = [{ id: 'a', completed: false, text: 'renamed' }];
    const previous = [{ id: 'a', completed: true, text: 'old name' }];

    const merged = preservePendingToggles(refreshed, new Set(['a']), previous);

    expect(merged[0]).toEqual({ id: 'a', completed: true, text: 'renamed' });
  });

  it('does not mutate the inputs', () => {
    const refreshed = [todo('a', false)];
    const previous = [todo('a', true)];

    preservePendingToggles(refreshed, new Set(['a']), previous);

    expect(refreshed[0].completed).toBe(false);
    expect(previous[0].completed).toBe(true);
  });
});
