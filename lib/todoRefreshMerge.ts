/**
 * Completing a todo updates local state optimistically, then writes to the
 * database. refreshLocalTodos re-reads the whole table and is re-triggered by
 * the todos observable - including by its own writes, since it normalises sort
 * ordering and syncs recurring occurrences.
 *
 * Two things follow, and both cause a completed todo to visibly flip back:
 *
 *   1. Overlapping refreshes can finish out of order, so an older snapshot can
 *      land last. See isRefreshSuperseded.
 *   2. A refresh that reads while a toggle is still in flight legitimately sees
 *      the old value, because the write has not happened yet. See
 *      preservePendingToggles.
 */

type TogglableTodo = {
  id: string;
  completed: boolean;
};

/**
 * True when a newer refresh started while this one was still reading, so this
 * snapshot is stale and must not be written.
 */
export const isRefreshSuperseded = (token: number, latestToken: number) => token !== latestToken;

/**
 * Keeps the optimistic `completed` value for todos whose toggle has not yet
 * been persisted, so a refresh mid-toggle does not untick the checkbox.
 */
export function preservePendingToggles<T extends TogglableTodo>(
  refreshed: readonly T[],
  pendingIds: ReadonlySet<string>,
  previous: readonly T[]
): T[] {
  if (!pendingIds.size) {
    return refreshed as T[];
  }

  const previousById = new Map(previous.map((todo) => [todo.id, todo]));

  return refreshed.map((todo) => {
    if (!pendingIds.has(todo.id)) {
      return todo;
    }

    const optimistic = previousById.get(todo.id);
    if (!optimistic || optimistic.completed === todo.completed) {
      return todo;
    }

    return { ...todo, completed: optimistic.completed };
  });
}
