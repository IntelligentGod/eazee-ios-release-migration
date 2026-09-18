import { useCallback, useEffect, useState } from 'react';
import {
  FREE_DAILY_AI_ACTIONS,
  FREE_DAILY_VOICE_SECONDS,
  FREE_SUBSCRIPTION_STATUS,
  readCachedSubscriptionStatus,
  type SubscriptionStatus,
  type SubscriptionTier,
} from '@/lib/subscription';
import { EMPTY_DAILY_USAGE, readDailyUsage, type DailyUsage } from '@/lib/subscriptionUsage';

export type SubscriptionSnapshot = {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  usage: DailyUsage;
  remainingAiActions: number;
  remainingVoiceSeconds: number;
  isLoading: boolean;
  refresh: () => void;
};

/**
 * Reads the cached entitlement plus today's usage. Purchases and the daily
 * reset both happen outside React, so `refresh` is exposed for screens that act
 * and need to re-read.
 */
export function useSubscriptionStatus(userId?: string | null): SubscriptionSnapshot {
  const [status, setStatus] = useState<SubscriptionStatus>(FREE_SUBSCRIPTION_STATUS);
  const [usage, setUsage] = useState<DailyUsage>(EMPTY_DAILY_USAGE);
  const [isLoading, setIsLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!userId) {
      setStatus(FREE_SUBSCRIPTION_STATUS);
      setUsage(EMPTY_DAILY_USAGE);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void Promise.all([readCachedSubscriptionStatus(userId), readDailyUsage(userId)])
      .then(([nextStatus, nextUsage]) => {
        if (cancelled) return;
        setStatus(nextStatus);
        setUsage(nextUsage);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nonce, userId]);

  return {
    tier: status.isPro ? 'pro' : 'free',
    status,
    usage,
    remainingAiActions: Math.max(0, FREE_DAILY_AI_ACTIONS - usage.aiActions),
    remainingVoiceSeconds: Math.max(0, FREE_DAILY_VOICE_SECONDS - usage.voiceSeconds),
    isLoading,
    refresh,
  };
}
