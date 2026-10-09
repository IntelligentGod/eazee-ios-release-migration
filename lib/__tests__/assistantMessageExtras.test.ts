import { parseAssistantMessageExtras, stripAssistantMarkers } from '@/lib/assistantMessageExtras';
import { buildSavedPreferencesSystemMessage, normalizeSavedPreferences } from '@/lib/aiSavedPreferences';
import { buildFirstChatSystemMessage, INITIAL_FIRST_CHAT_STATE, normalizeFirstChatState } from '@/lib/firstChatOnboarding';

describe('assistant message markers', () => {
  it('turns markers into buttons and hides them from the text', () => {
    const extras = parseAssistantMessageExtras([
      'Here is your summary.',
      '',
      '[[copy]]',
      '[[result: draft]]',
      '[[options: Make it shorter | Adjust the tone | Make it shorter]]',
      '[[remember: tone=direct | Should I remember that you like a direct tone?]]',
    ].join('\n'));

    expect(extras.text).toBe('Here is your summary.');
    expect(extras.copyable).toBe(true);
    expect(extras.result).toBe('draft');
    expect(extras.options).toEqual(['Make it shorter', 'Adjust the tone']);
    expect(extras.remember).toEqual({ field: 'tone', value: 'direct', question: 'Should I remember that you like a direct tone?' });
  });

  it('reads proposed tasks and goals, defaulting an unknown timeframe', () => {
    const extras = parseAssistantMessageExtras('Plan ready.\n[[tasks: Update CV summary | Apply to 3 roles]]\n[[goal: Find a remote job | someday]]');
    expect(extras.tasks).toEqual(['Update CV summary', 'Apply to 3 roles']);
    expect(extras.goal).toEqual({ title: 'Find a remote job', timeframe: 'thisWeek' });
  });

  it('ignores preferences the app does not support', () => {
    const extras = parseAssistantMessageExtras('Ok.\n[[save_preference: responseLength=short]]\n[[save_preference: mood=angry]]\n[[remember: tone=rude | Remember?]]');
    expect(extras.savePreferences).toEqual([{ field: 'responseLength', value: 'short' }]);
    expect(extras.remember).toBeNull();
  });

  it('hides a half-written marker while a reply streams in', () => {
    expect(stripAssistantMarkers('Here you go.\n[[options: Make it')).toBe('Here you go.');
    expect(stripAssistantMarkers('No markers here.')).toBe('No markers here.');
  });
});

describe('saved preferences', () => {
  it('keeps one value per field, drops unknown ones, and is silent when off or empty', () => {
    const store = normalizeSavedPreferences({
      preferences: [
        { field: 'planStyle', value: 'timed', source: 'chat', updatedAt: 1 },
        { field: 'planStyle', value: 'flexible', source: 'chat', updatedAt: 2 },
        { field: 'planStyle', value: 'chaotic', source: 'chat', updatedAt: 3 },
        { field: 'secret', value: 'x' },
      ],
    });
    expect(store.preferences).toEqual([{ field: 'planStyle', value: 'flexible', source: 'chat', updatedAt: 2 }]);
    expect(buildSavedPreferencesSystemMessage(store)).toContain('flexible priority list');
    expect(buildSavedPreferencesSystemMessage({ ...store, enabled: false })).toBeNull();
    expect(buildSavedPreferencesSystemMessage({ enabled: true, preferences: [] })).toBeNull();
  });
});

describe('first-chat onboarding', () => {
  it('describes the chosen starter and stops offering the preference prompt once shown', () => {
    const message = buildFirstChatSystemMessage({ ...INITIAL_FIRST_CHAT_STATE, status: 'in_progress', intent: 'write' });
    expect(message).toContain('Write a message');
    expect(message).toContain('A usable draft');
    expect(buildFirstChatSystemMessage({ ...INITIAL_FIRST_CHAT_STATE, preferencePromptShown: true }))
      .toContain('do not ask again');
  });

  it('falls back to a fresh state for anything unreadable', () => {
    expect(normalizeFirstChatState({ status: 'weird', intent: 'x', assistantReplies: -3 })).toMatchObject({
      status: 'not_started',
      intent: undefined,
      assistantReplies: 0,
    });
  });
});
