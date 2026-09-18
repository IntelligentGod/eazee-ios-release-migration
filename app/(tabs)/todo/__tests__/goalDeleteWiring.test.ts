import fs from 'fs';
import path from 'path';

/**
 * Goals had no delete path at all: progress-type rows skip the Swipeable that
 * gives basic todos swipe-to-delete, and the details meta card holding the
 * Delete row is wrapped in {!isGoalDetailsSheet && ...}. handleDeleteTodo was
 * already goal-aware - only the entry point was missing.
 *
 * These assert the affordance exists and stays confirmed, since goal deletes
 * cascade into the guidance plan and are excluded from the undo snackbar.
 */
const source = fs.readFileSync(path.join(__dirname, '..', 'index.tsx'), 'utf8');

describe('goal delete wiring', () => {
  it('shows a delete action on the goal details sheet', () => {
    expect(source).toMatch(
      /\{isGoalDetailsSheet && \([\s\S]{0,600}handleRequestDeleteGoal\(\)/
    );
    expect(source).toMatch(/>Delete goal</);
  });

  it('confirms before deleting, because goal deletes cannot be undone', () => {
    expect(source).toMatch(/handleRequestDeleteGoal = \(\) => \{[\s\S]{0,400}Alert\.alert\(/);
    expect(source).toMatch(/style: 'destructive'[\s\S]{0,120}handleDeleteTodo\(\)/);
  });

  it('still routes goal deletes through the guidance cleanup', () => {
    expect(source).toMatch(
      /workspace === 'Goals'\)\s*\{\s*await deleteGoalGuidanceForGoal\(todoToDelete\.id\)/
    );
  });

  it('keeps goal deletes out of the undo snackbar', () => {
    expect(source).toMatch(/setLastDeletedTodo\(isGoalDelete/);
  });
});
