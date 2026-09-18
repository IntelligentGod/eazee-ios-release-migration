import {
  FREE_DAILY_AI_ACTIONS,
  FREE_DAILY_VOICE_SECONDS,
  PRO_ONLY_FEATURES,
  UNCHARGED_CHAT_FEATURES,
  isProOnlyFeature,
  writeCachedSubscriptionStatus,
  type AiFeatureKey,
} from '@/lib/subscription';
import {
  EMPTY_DAILY_USAGE,
  checkAiFeatureAccess,
  decideAiFeatureAccess,
  getUsagePeriodKey,
  readDailyUsage,
  recordAiAction,
  recordVoiceUsage,
  type DailyUsage,
} from '@/lib/subscriptionUsage';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete store[key];
    }),
    __reset: () => {
      store = {};
    },
  };
});

const storageMock = jest.requireMock('@react-native-async-storage/async-storage') as {
  __reset: () => void;
};

const usage = (overrides: Partial<DailyUsage> = {}): DailyUsage => ({
  ...EMPTY_DAILY_USAGE,
  ...overrides,
});

// A Sunday, which isHomeSuggestionDayForFree treats as a suggestion day.
const SUGGESTION_DAY = new Date(2026, 8, 20);

describe('plan entitlements', () => {
  describe('free tier', () => {
    it('allows chat until the daily allowance is spent', () => {
      expect(decideAiFeatureAccess('free', 'aiChat', usage({ aiActions: 0 }))).toEqual({
        allowed: true,
      });
      expect(
        decideAiFeatureAccess('free', 'aiChat', usage({ aiActions: FREE_DAILY_AI_ACTIONS - 1 }))
      ).toEqual({ allowed: true });
      expect(
        decideAiFeatureAccess('free', 'aiChat', usage({ aiActions: FREE_DAILY_AI_ACTIONS }))
      ).toEqual({ allowed: false, reason: 'aiActionsExhausted' });
    });

    it('allows voice until the daily minutes are spent', () => {
      expect(
        decideAiFeatureAccess(
          'free',
          'voiceInput',
          usage({ voiceSeconds: FREE_DAILY_VOICE_SECONDS - 1 })
        )
      ).toEqual({ allowed: true });
      expect(
        decideAiFeatureAccess(
          'free',
          'voiceInput',
          usage({ voiceSeconds: FREE_DAILY_VOICE_SECONDS })
        )
      ).toEqual({ allowed: false, reason: 'voiceExhausted' });
    });

    it('meters voice separately from chat actions', () => {
      expect(
        decideAiFeatureAccess('free', 'voiceInput', usage({ aiActions: FREE_DAILY_AI_ACTIONS }))
      ).toEqual({ allowed: true });
      expect(
        decideAiFeatureAccess('free', 'aiChat', usage({ voiceSeconds: FREE_DAILY_VOICE_SECONDS }))
      ).toEqual({ allowed: true });
    });

    it.each(PRO_ONLY_FEATURES)('refuses %s even with allowance left', (feature) => {
      expect(decideAiFeatureAccess('free', feature, usage())).toEqual({
        allowed: false,
        reason: 'proOnly',
      });
    });

    it('keeps wishlist purchase intent on the free plan', () => {
      expect(decideAiFeatureAccess('free', 'wishlistIntent', usage(), SUGGESTION_DAY)).toEqual({
        allowed: true,
      });
      expect(isProOnlyFeature('wishlistIntent')).toBe(false);
    });

    it('gives home suggestions on some days and not others', () => {
      const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
        const date = new Date(2026, 8, 20 + offset);
        return decideAiFeatureAccess('free', 'homeSuggestions', usage(), date).allowed;
      });

      expect(days.filter(Boolean).length).toBeGreaterThan(0);
      expect(days.filter((allowed) => !allowed).length).toBeGreaterThan(0);
    });

    // Refusing these would strand an agent turn mid-loop, or leave a session
    // untitled, after the user already paid for the turn.
    it.each(UNCHARGED_CHAT_FEATURES)('still allows %s once the allowance is spent', (feature) => {
      expect(
        decideAiFeatureAccess('free', feature, usage({ aiActions: FREE_DAILY_AI_ACTIONS }))
      ).toEqual({ allowed: true });
    });
  });

  describe('pro tier', () => {
    const allFeatures: AiFeatureKey[] = [
      'aiChat',
      'aiChatToolResult',
      'aiChatTitle',
      'voiceInput',
      'homeSuggestions',
      'wishlistIntent',
      ...PRO_ONLY_FEATURES,
    ];

    it.each(allFeatures)('allows %s regardless of usage', (feature) => {
      expect(
        decideAiFeatureAccess('pro', feature, usage({ aiActions: 9_999, voiceSeconds: 9_999 }))
      ).toEqual({ allowed: true });
    });
  });
});

describe('usage period', () => {
  it('buckets by calendar day so allowances reset overnight', () => {
    expect(getUsagePeriodKey(new Date(2026, 8, 18, 23, 59))).toBe('2026-09-18');
    expect(getUsagePeriodKey(new Date(2026, 8, 19, 0, 1))).toBe('2026-09-19');
    expect(getUsagePeriodKey(new Date(2026, 11, 5))).toBe('2026-12-05');
  });
});

describe('usage accounting', () => {
  beforeEach(() => {
    storageMock.__reset();
  });

  it('accumulates actions and voice seconds per user', async () => {
    await recordAiAction('user-1');
    await recordAiAction('user-1');
    await recordVoiceUsage('user-1', 42.4);

    await expect(readDailyUsage('user-1')).resolves.toEqual({ aiActions: 2, voiceSeconds: 42 });
  });

  it('keeps usage isolated between users', async () => {
    await recordAiAction('user-1');

    await expect(readDailyUsage('user-2')).resolves.toEqual(EMPTY_DAILY_USAGE);
  });

  it('ignores non-positive voice durations', async () => {
    await recordVoiceUsage('user-1', 0);
    await recordVoiceUsage('user-1', -5);

    await expect(readDailyUsage('user-1')).resolves.toEqual(EMPTY_DAILY_USAGE);
  });

  it('reads another day as empty so the allowance resets', async () => {
    await recordAiAction('user-1');

    await expect(readDailyUsage('user-1', '1999-01-01')).resolves.toEqual(EMPTY_DAILY_USAGE);
  });

  it('blocks a free user once the daily allowance is spent', async () => {
    for (let i = 0; i < FREE_DAILY_AI_ACTIONS; i += 1) {
      await recordAiAction('user-1');
    }

    await expect(checkAiFeatureAccess('user-1', 'aiChat')).resolves.toEqual({
      allowed: false,
      reason: 'aiActionsExhausted',
    });
  });

  it('unblocks the same user once they are on pro', async () => {
    for (let i = 0; i < FREE_DAILY_AI_ACTIONS; i += 1) {
      await recordAiAction('user-1');
    }
    await writeCachedSubscriptionStatus('user-1', {
      isPro: true,
      planId: 'yearly',
      verifiedAt: Date.now(),
    });

    await expect(checkAiFeatureAccess('user-1', 'aiChat')).resolves.toEqual({ allowed: true });
    await expect(checkAiFeatureAccess('user-1', 'guidance')).resolves.toEqual({ allowed: true });
  });
});
