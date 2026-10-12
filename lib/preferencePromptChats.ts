import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The preference follow-ups ("Timed schedule or flexible list?" then "Should I remember
 * that you prefer …?") run in each of an account's first few chats, then stop. Existing
 * users start counting from their next chat. Kept per account on this device.
 */
export const PREFERENCE_PROMPT_CHAT_LIMIT = 3;

const storageKey = (userId: string) => `preferencePromptChats:v1:${userId}`;

export async function readPreferencePromptChatIds(userId?: string | null): Promise<string[]> {
  if (!userId) return [];
  try {
    const stored = JSON.parse((await AsyncStorage.getItem(storageKey(userId))) || '[]');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string').slice(0, PREFERENCE_PROMPT_CHAT_LIMIT) : [];
  } catch {
    return [];
  }
}

/**
 * Counts this chat as one of the first few if there is room. Returns the counted chats
 * and whether this one is among them.
 */
export async function claimPreferencePromptChat(userId: string, sessionId: string) {
  const sessionIds = await readPreferencePromptChatIds(userId);
  if (sessionIds.includes(sessionId)) return { sessionIds, isPreferenceChat: true };
  if (sessionIds.length >= PREFERENCE_PROMPT_CHAT_LIMIT) return { sessionIds, isPreferenceChat: false };
  const next = [...sessionIds, sessionId];
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {}
  return { sessionIds: next, isPreferenceChat: true };
}

/** For a counted chat outside the first-use flow, which has its own version of this. */
export const PREFERENCE_FOLLOW_UP_SYSTEM_MESSAGE = [
  'PREFERENCE FOLLOW-UP (this is one of the user\'s first chats).',
  'When a choice about how the user likes things would materially improve this result, ask it once in this conversation with [[options: ...]] buttons, keeping free-text replies welcome. Examples: planning: [[options: Timed schedule | Flexible priority list]]; getting started: [[options: One small step | The full plan]]; writing: [[options: Professional | Friendly | Direct]].',
  'Skip the question when the user already said it or a saved preference covers it, and never interrupt useful work to collect profile information. Apply the answer to this task only; do not treat a task choice as a permanent trait.',
  'After you deliver the result, you may ask once whether to remember the preference the user chose, with [[remember: ...]]. Do not save it yourself unless they explicitly ask.',
].join('\n');
