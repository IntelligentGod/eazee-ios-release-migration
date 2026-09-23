import { LIFE_AREA_KEYS, type LifeAreaKey } from '@/src/blob/lifeGraph';

/**
 * Temporary keyword categoriser for the Life Graph prototype, so arms can be
 * driven by real todos before any real categorisation exists.
 *
 * Replace with /ai/todo/classify (see lib/todoClassification.ts) or an explicit
 * user-set area once the concept is confirmed - keywords will misread plenty of
 * real tasks, and only English ones at that.
 */
const AREA_KEYWORDS: Record<LifeAreaKey, string[]> = {
  health: [
    'gym', 'workout', 'exercise', 'run', 'running', 'walk', 'yoga', 'doctor',
    'dentist', 'medicine', 'sleep', 'water', 'meditate', 'health', 'training',
    'swim', 'cycle', 'diet', 'vitamin', 'therapy', 'appointment',
  ],
  relationships: [
    'call', 'meet', 'dinner', 'lunch', 'coffee', 'birthday', 'family', 'friend',
    'mum', 'mom', 'dad', 'parents', 'partner', 'wife', 'husband', 'date',
    'visit', 'gift', 'party', 'wedding', 'text', 'message',
  ],
  work: [
    'work', 'meeting', 'boss', 'client', 'project', 'deadline', 'report',
    'email', 'presentation', 'invoice', 'standup', 'review', 'interview',
    'slides', 'ticket', 'launch', 'sprint', 'proposal',
  ],
  home: [
    'clean', 'laundry', 'dishes', 'grocery', 'groceries', 'shopping', 'cook',
    'tidy', 'repair', 'fix', 'bills', 'rent', 'trash', 'garden', 'vacuum',
    'organise', 'organize', 'kitchen', 'bedroom', 'home',
  ],
  growth: [
    'read', 'book', 'learn', 'study', 'course', 'practice', 'language',
    'skill', 'tutorial', 'write', 'journal', 'plan', 'goal', 'research',
    'lesson', 'guitar', 'piano', 'code', 'coding',
  ],
};

const WORKSPACE_FALLBACK: Record<string, LifeAreaKey> = {
  Goals: 'growth',
  Wishlist: 'home',
};

/**
 * Best-guess area for a task. Falls back to the workspace, then to 'work' so
 * every completion grows something rather than silently vanishing.
 */
export function classifyLifeArea(text?: string | null, workspace?: string | null): LifeAreaKey {
  const haystack = String(text || '').toLowerCase();

  if (haystack) {
    let bestArea: LifeAreaKey | null = null;
    let bestScore = 0;

    for (const area of LIFE_AREA_KEYS) {
      const score = AREA_KEYWORDS[area].reduce(
        (total, keyword) => (haystack.includes(keyword) ? total + 1 : total),
        0
      );
      if (score > bestScore) {
        bestScore = score;
        bestArea = area;
      }
    }

    if (bestArea) {
      return bestArea;
    }
  }

  return (workspace && WORKSPACE_FALLBACK[workspace]) || 'work';
}
