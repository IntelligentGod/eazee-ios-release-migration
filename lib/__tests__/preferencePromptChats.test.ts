const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => store[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    store[key] = value;
  }),
}));

import { claimPreferencePromptChat, readPreferencePromptChatIds } from '@/lib/preferencePromptChats';

describe('preference follow-ups in the first chats', () => {
  it('counts the first three chats, keeps them, and stops after', async () => {
    expect((await claimPreferencePromptChat('u1', 'chat-1')).isPreferenceChat).toBe(true);
    expect((await claimPreferencePromptChat('u1', 'chat-2')).isPreferenceChat).toBe(true);
    expect((await claimPreferencePromptChat('u1', 'chat-1')).isPreferenceChat).toBe(true);
    expect((await claimPreferencePromptChat('u1', 'chat-3')).isPreferenceChat).toBe(true);
    const fourth = await claimPreferencePromptChat('u1', 'chat-4');
    expect(fourth.isPreferenceChat).toBe(false);
    expect(fourth.sessionIds).toEqual(['chat-1', 'chat-2', 'chat-3']);
    expect((await claimPreferencePromptChat('u1', 'chat-2')).isPreferenceChat).toBe(true);
  });

  it('counts per account, so an existing user starts from zero', async () => {
    expect(await readPreferencePromptChatIds('u2')).toEqual([]);
    expect((await claimPreferencePromptChat('u2', 'chat-a')).isPreferenceChat).toBe(true);
    expect(await readPreferencePromptChatIds(null)).toEqual([]);
  });
});
