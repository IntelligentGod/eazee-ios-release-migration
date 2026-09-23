export interface TodoWorkspaceAppearance {
  themeColor: string;
  overallGradientColors: [string, string];
  overallGradientStart: { x: number; y: number };
  overallGradientEnd: { x: number; y: number };
  screenTitle: string;
  headerTitleColor: string;
  headerMenuColor: string;
  workspaceShellColor: string;
  sectionGradientColors: [string, string];
  todoCardGradientColors: [string, string];
  todoCardStrokeColor: string;
  workspaceDotColor: string;
  aiInputBgColor: string;
  aiInputStrokeColor: string;
  aiMicBgColor: string;
  aiMicStrokeColor: string;
  /** Floating tab bar icon colour, per workspace ground. */
  tabBarTint: string;
  /**
   * Workspace name and Create label colour. Only set where the shared theme's
   * workspaceNameColor is illegible against this workspace's ground - Wishlist
   * stays bright to the bottom, where #3BCAB1 measures 1.45:1.
   */
  workspaceLabelColor?: string;
}

const PERSONAL_APPEARANCE: TodoWorkspaceAppearance = {
  themeColor: '#22AB93',
  overallGradientColors: ['#22AB93', '#0E453B'],
  overallGradientStart: { x: 0, y: 0 },
  overallGradientEnd: { x: 1, y: 1 },
  screenTitle: 'To Do',
  headerTitleColor: '#82E2CD',
  headerMenuColor: '#297769',
  workspaceShellColor: 'rgba(24, 94, 82, 0.25)',
  sectionGradientColors: ['#3BCAB1', '#1D6457'],
  todoCardGradientColors: ['#9BE4D7', '#47A090'],
  todoCardStrokeColor: '#43A5A4',
  workspaceDotColor: '#3BCAB1',
  aiInputBgColor: '#3BCAB1',
  aiInputStrokeColor: '#F8F8F8',
  aiMicBgColor: '#3BCAB1',
  aiMicStrokeColor: '#F8F8F8',
  tabBarTint: '#AEFFE8',
};

const GOALS_APPEARANCE: TodoWorkspaceAppearance = {
  themeColor: '#22AB93',
  overallGradientColors: ['#2C5C54', '#011915'],
  overallGradientStart: { x: 0, y: 0 },
  overallGradientEnd: { x: 1, y: 1 },
  screenTitle: 'To Do',
  headerTitleColor: '#82E2CD',
  headerMenuColor: '#297769',
  workspaceShellColor: 'rgba(8, 26, 23, 0.25)',
  sectionGradientColors: ['#4B9387', '#024035'],
  todoCardGradientColors: ['#9BE4D7', '#47A090'],
  todoCardStrokeColor: '#43A5A4',
  workspaceDotColor: '#3BCAB1',
  aiInputBgColor: '#3BCAB1',
  aiInputStrokeColor: '#F8F8F8',
  aiMicBgColor: '#3BCAB1',
  aiMicStrokeColor: '#F8F8F8',
  tabBarTint: '#AEFFE8',
};

const WISHLIST_APPEARANCE: TodoWorkspaceAppearance = {
  themeColor: '#22AB93',
  overallGradientColors: ['#22AB82', '#1BA8B8'],
  overallGradientStart: { x: 0, y: 0 },
  overallGradientEnd: { x: 1, y: 1 },
  screenTitle: 'To Do',
  headerTitleColor: '#82E2CD',
  headerMenuColor: '#297769',
  workspaceShellColor: 'rgba(8, 26, 23, 0.25)',
  sectionGradientColors: ['#3BCAB1', '#1D6457'],
  todoCardGradientColors: ['#9BE4D7', '#47A090'],
  todoCardStrokeColor: '#43A5A4',
  workspaceDotColor: '#3BCAB1',
  aiInputBgColor: '#3BCAB1',
  aiInputStrokeColor: '#F8F8F8',
  aiMicBgColor: '#3BCAB1',
  aiMicStrokeColor: '#F8F8F8',
  tabBarTint: '#FFFFFF',
  workspaceLabelColor: '#FFFFFF',
};

export const TODO_WORKSPACE_APPEARANCES: Record<string, TodoWorkspaceAppearance> = {
  Personal: PERSONAL_APPEARANCE,
  Goals: {
    ...GOALS_APPEARANCE,
    screenTitle: 'Goals',
  },
  Wishlist: {
    ...WISHLIST_APPEARANCE,
    screenTitle: 'Wish-list',
  },
};

export const getTodoWorkspaceAppearance = (workspaceKey?: string) => {
  if (!workspaceKey) {
    return null;
  }

  return TODO_WORKSPACE_APPEARANCES[workspaceKey] || null;
};
