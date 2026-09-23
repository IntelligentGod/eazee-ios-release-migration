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
    expect(source).toMatch(
      /handleRequestDeleteGoal = \(\) => \{[\s\S]{0,200}setIsDeleteGoalConfirmVisible\(true\)/
    );
    expect(source).toMatch(
      /handleConfirmDeleteGoal = \(\) => \{[\s\S]{0,200}handleDeleteTodo\(\)/
    );
  });

  it('uses the in-app ConfirmDialog rather than a system Alert', () => {
    expect(source).toMatch(
      /<ConfirmDialog[\s\S]{0,400}visible=\{isDeleteGoalConfirmVisible\}[\s\S]{0,400}onConfirm=\{handleConfirmDeleteGoal\}/
    );
    expect(source).toMatch(/import ConfirmDialog from '@\/components\/ConfirmDialog'/);
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
