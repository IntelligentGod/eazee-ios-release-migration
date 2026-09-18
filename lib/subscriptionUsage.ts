import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FREE_DAILY_AI_ACTIONS,
  FREE_DAILY_VOICE_SECONDS,
  FREE_HOME_SUGGESTION_DAYS_PER_WEEK,
  isProOnlyFeature,
  isUnchargedChatFeature,
  readCachedSubscriptionStatus,
  type AiFeatureKey,
  type SubscriptionTier,
} from '@/lib/subscription';

export type DailyUsage = {
  aiActions: number;
  voiceSeconds: number;
};

export const EMPTY_DAILY_USAGE: DailyUsage = { aiActions: 0, voiceSeconds: 0 };

const USAGE_STORAGE_KEY_PREFIX = 'subscription:usage:v2:';

/**
 * Allowances reset daily, so the day is part of the key and yesterday simply
 * reads back as empty - no reset job. Uses the device's local day to match what
 * the user sees.
 */
export function getUsagePeriodKey(now: Date = new Date()) {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const getUsageStorageKey = (userId: string, periodKey: string) =>
  `${USAGE_STORAGE_KEY_PREFIX}${userId}:${periodKey}`;

export async function readDailyUsage(
  userId: string,
  periodKey: string = getUsagePeriodKey()
): Promise<DailyUsage> {
  try {
    const stored = await AsyncStorage.getItem(getUsageStorageKey(userId, periodKey));
    if (!stored) {
      return EMPTY_DAILY_USAGE;
    }

    const parsed = JSON.parse(stored) as Partial<DailyUsage>;
    return {
      aiActions:
        typeof parsed?.aiActions === 'number' && parsed.aiActions > 0 ? parsed.aiActions : 0,
      voiceSeconds:
        typeof parsed?.voiceSeconds === 'number' && parsed.voiceSeconds > 0
          ? parsed.voiceSeconds
          : 0,
    };
  } catch {
    return EMPTY_DAILY_USAGE;
  }
}

async function writeDailyUsage(userId: string, periodKey: string, usage: DailyUsage) {
  try {
    await AsyncStorage.setItem(getUsageStorageKey(userId, periodKey), JSON.stringify(usage));
  } catch (error) {
    console.warn('Failed to record subscription usage', error);
  }
}

export async function recordAiAction(userId: string, count = 1) {
  const periodKey = getUsagePeriodKey();
  const usage = await readDailyUsage(userId, periodKey);
  await writeDailyUsage(userId, periodKey, { ...usage, aiActions: usage.aiActions + count });
}

export async function recordVoiceUsage(userId: string, seconds: number) {
  if (!(seconds > 0)) {
    return;
  }

  const periodKey = getUsagePeriodKey();
  const usage = await readDailyUsage(userId, periodKey);
  await writeDailyUsage(userId, periodKey, {
    ...usage,
    voiceSeconds: usage.voiceSeconds + Math.round(seconds),
  });
}

export async function clearDailyUsage(userId: string, periodKey: string = getUsagePeriodKey()) {
  try {
    await AsyncStorage.removeItem(getUsageStorageKey(userId, periodKey));
  } catch (error) {
    console.warn('Failed to clear subscription usage', error);
  }
}

/**
 * Free gets home suggestions on a fixed subset of weekdays rather than a random
 * sample, so the pattern is stable for a given user and does not flicker when
 * the screen remounts.
 */
export function isHomeSuggestionDayForFree(now: Date = new Date()) {
  const weekday = now.getDay();
  return weekday % Math.ceil(7 / FREE_HOME_SUGGESTION_DAYS_PER_WEEK) === 0;
}

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: 'proOnly' | 'aiActionsExhausted' | 'voiceExhausted' | 'notToday' };

/**
 * Pure so the tier rules can be tested without storage. Pro passes everything -
 * its fair-use ceilings are surfaced in the UI, not enforced here.
 */
export function decideAiFeatureAccess(
  tier: SubscriptionTier,
  feature: AiFeatureKey,
  usage: DailyUsage,
  now: Date = new Date()
): AccessDecision {
  if (tier === 'pro') {
    return { allowed: true };
  }

  if (isProOnlyFeature(feature)) {
    return { allowed: false, reason: 'proOnly' };
  }

  if (isUnchargedChatFeature(feature)) {
    return { allowed: true };
  }

  if (feature === 'homeSuggestions') {
    return isHomeSuggestionDayForFree(now)
      ? { allowed: true }
      : { allowed: false, reason: 'notToday' };
  }

  if (feature === 'voiceInput') {
    return usage.voiceSeconds >= FREE_DAILY_VOICE_SECONDS
      ? { allowed: false, reason: 'voiceExhausted' }
      : { allowed: true };
  }

  return usage.aiActions >= FREE_DAILY_AI_ACTIONS
    ? { allowed: false, reason: 'aiActionsExhausted' }
    : { allowed: true };
}

export async function checkAiFeatureAccess(
  userId: string,
  feature: AiFeatureKey
): Promise<AccessDecision> {
  const [status, usage] = await Promise.all([
    readCachedSubscriptionStatus(userId),
    readDailyUsage(userId),
  ]);

  return decideAiFeatureAccess(status.isPro ? 'pro' : 'free', feature, usage);
}
