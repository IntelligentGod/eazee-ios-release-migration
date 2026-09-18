import {
  FREE_DAILY_AI_ACTIONS,
  FREE_DAILY_VOICE_SECONDS,
  type AiFeatureKey,
} from '@/lib/subscription';
import type { AccessDecision } from '@/lib/subscriptionUsage';

export type SubscriptionRequiredReason =
  | 'proOnly'
  | 'aiActionsExhausted'
  | 'voiceExhausted'
  | 'notToday';

export const SUBSCRIPTION_REQUIRED_MESSAGES: Record<SubscriptionRequiredReason, string> = {
  proOnly: 'This is an Eazee Pro feature. Upgrade to turn it on.',
  aiActionsExhausted: `You have used today's ${FREE_DAILY_AI_ACTIONS} free AI actions. They reset tomorrow, or upgrade to Eazee Pro for unlimited.`,
  voiceExhausted: `You have used today's ${FREE_DAILY_VOICE_SECONDS / 60} minutes of free voice input. It resets tomorrow, or upgrade to Eazee Pro for unlimited.`,
  notToday: 'Eazee Pro gets daily suggestions every day. On the free plan they arrive a few days a week.',
};

export class SubscriptionRequiredError extends Error {
  readonly reason: SubscriptionRequiredReason;
  readonly feature: AiFeatureKey;

  constructor(reason: SubscriptionRequiredReason, feature: AiFeatureKey) {
    super(SUBSCRIPTION_REQUIRED_MESSAGES[reason]);
    this.name = 'SubscriptionRequiredError';
    this.reason = reason;
    this.feature = feature;
  }
}

export const createSubscriptionRequiredError = (
  decision: Extract<AccessDecision, { allowed: false }>,
  feature: AiFeatureKey
) => new SubscriptionRequiredError(decision.reason, feature);

export const isSubscriptionRequiredError = (error: unknown): error is SubscriptionRequiredError =>
  error instanceof SubscriptionRequiredError
  || (error as any)?.name === 'SubscriptionRequiredError';
