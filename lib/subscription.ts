import AsyncStorage from '@react-native-async-storage/async-storage';

export type SubscriptionPlanId = 'monthly' | 'yearly';

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  title: string;
  price: string;
  period: string;
  caption: string;
  highlight: boolean;
  /** Store product id. Create these in App Store Connect and Play Console. */
  productId: string;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    title: 'Monthly',
    price: '$9.99',
    period: '/ month',
    caption: 'Cancel anytime',
    highlight: false,
    productId: 'com.eazee.ai.pro.monthly',
  },
  {
    id: 'yearly',
    title: 'Yearly',
    price: '$79.99',
    period: '/ year',
    caption: 'Save 33% (only $6.67/month)',
    highlight: true,
    productId: 'com.eazee.ai.pro.yearly',
  },
];

export const DEFAULT_SUBSCRIPTION_PLAN_ID: SubscriptionPlanId = 'yearly';

export const TRIAL_DAYS = 14;

export type SubscriptionTier = 'free' | 'pro';

/**
 * Server-backed AI capabilities, grouped by how they are billed rather than by
 * endpoint.
 */
export type AiFeatureKey =
  | 'aiChat'
  | 'aiChatToolResult'
  | 'aiChatTitle'
  | 'voiceInput'
  | 'homeSuggestions'
  | 'dayPlanning'
  | 'guidance'
  | 'todoClassification'
  | 'recipeAndSkill'
  | 'wishlistIntent';

/** Capabilities Free never gets, regardless of remaining allowance. */
export const PRO_ONLY_FEATURES: readonly AiFeatureKey[] = [
  'dayPlanning',
  'guidance',
  'todoClassification',
  'recipeAndSkill',
];

/**
 * Work that finishes a turn the user already spent an action on: the agent loop
 * posting a tool result back, and the automatic session title. Never charged
 * and never refused - blocking these would strand an in-flight conversation or
 * quietly spend the allowance on something the user did not ask for.
 */
export const UNCHARGED_CHAT_FEATURES: readonly AiFeatureKey[] = ['aiChatToolResult', 'aiChatTitle'];

export const isProOnlyFeature = (feature: AiFeatureKey) => PRO_ONLY_FEATURES.includes(feature);

export const isUnchargedChatFeature = (feature: AiFeatureKey) =>
  UNCHARGED_CHAT_FEATURES.includes(feature);

/** Free allowances reset daily so a heavy day never kills the rest of the week. */
export const FREE_DAILY_AI_ACTIONS = 5;
export const FREE_DAILY_VOICE_SECONDS = 2 * 60;

/** Free gets daily home suggestions on this many days per week. */
export const FREE_HOME_SUGGESTION_DAYS_PER_WEEK = 3;

/**
 * Pro is "unlimited (fair use)". Tracked and surfaced, deliberately not
 * enforced on the client - a subscriber who trips one should be contacted, not
 * cut off mid-sentence.
 */
export const PRO_FAIR_USE_DAILY_AI_ACTIONS = 200;
export const PRO_FAIR_USE_DAILY_VOICE_SECONDS = 60 * 60;

export type ComparisonValue = { kind: 'check' } | { kind: 'none' } | { kind: 'text'; label: string };

export type ComparisonRow = {
  icon:
    | 'text-box-outline'
    | 'google'
    | 'shimmer'
    | 'microphone-outline'
    | 'home-outline'
    | 'target'
    | 'format-list-bulleted'
    | 'play-circle-outline'
    | 'cart-outline';
  title: string;
  description: string;
  free: ComparisonValue;
  pro: ComparisonValue;
};

export const PLAN_COMPARISON_ROWS: ComparisonRow[] = [
  {
    icon: 'text-box-outline',
    title: 'Notes / todos / calendar / booking',
    description: 'Keep your life in one place',
    free: { kind: 'text', label: 'Unlimited' },
    pro: { kind: 'text', label: 'Unlimited' },
  },
  {
    icon: 'google',
    title: 'Google Calendar sync',
    description: 'Sync your events and stay on track',
    free: { kind: 'check' },
    pro: { kind: 'check' },
  },
  {
    icon: 'shimmer',
    title: 'AI actions',
    description: 'Get things done with AI',
    free: { kind: 'text', label: `${FREE_DAILY_AI_ACTIONS} per day` },
    pro: { kind: 'text', label: 'Unlimited\n(fair use)' },
  },
  {
    icon: 'microphone-outline',
    title: 'Voice input',
    description: 'Speak naturally, get things done',
    free: { kind: 'text', label: `${FREE_DAILY_VOICE_SECONDS / 60} min / day` },
    pro: { kind: 'text', label: 'Unlimited\n(fair use)' },
  },
  {
    icon: 'home-outline',
    title: 'Daily home suggestions',
    description: 'Personalized ideas to improve your day',
    free: { kind: 'text', label: `${FREE_HOME_SUGGESTION_DAYS_PER_WEEK} days / week` },
    pro: { kind: 'text', label: 'Every day' },
  },
  {
    icon: 'target',
    title: 'Day planning, goal & task guidance',
    description: 'Plan smarter with AI',
    free: { kind: 'none' },
    pro: { kind: 'check' },
  },
  {
    icon: 'format-list-bulleted',
    title: 'Auto todo classification',
    description: 'Let AI organize your tasks',
    free: { kind: 'none' },
    pro: { kind: 'check' },
  },
  {
    icon: 'play-circle-outline',
    title: 'Recipe & skill generation, video lookup',
    description: 'Find recipes, learn new skills',
    free: { kind: 'none' },
    pro: { kind: 'check' },
  },
  {
    icon: 'cart-outline',
    title: 'Wishlist purchase intent',
    description: 'Save ideas and get smart shopping help',
    free: { kind: 'check' },
    pro: { kind: 'check' },
  },
];

export type SubscriptionStatus = {
  isPro: boolean;
  planId: SubscriptionPlanId | null;
  /** Epoch ms the entitlement was last confirmed by the store or backend. */
  verifiedAt: number | null;
};

export const FREE_SUBSCRIPTION_STATUS: SubscriptionStatus = {
  isPro: false,
  planId: null,
  verifiedAt: null,
};

export type BillingOutcome =
  | { status: 'success'; planId: SubscriptionPlanId }
  | { status: 'cancelled' }
  | { status: 'unavailable'; message: string };

const SUBSCRIPTION_STATUS_STORAGE_KEY = 'subscription:status:v1:';

const getStatusStorageKey = (userId: string) => `${SUBSCRIPTION_STATUS_STORAGE_KEY}${userId}`;

/**
 * Entitlement is cached per user so the app renders the right tier offline. The
 * store and the backend stay the source of truth - this is only ever refreshed
 * from a verified result.
 */
export async function readCachedSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  try {
    const stored = await AsyncStorage.getItem(getStatusStorageKey(userId));
    if (!stored) {
      return FREE_SUBSCRIPTION_STATUS;
    }

    const parsed = JSON.parse(stored) as Partial<SubscriptionStatus>;
    if (typeof parsed?.isPro !== 'boolean') {
      return FREE_SUBSCRIPTION_STATUS;
    }

    return {
      isPro: parsed.isPro,
      planId: parsed.planId === 'monthly' || parsed.planId === 'yearly' ? parsed.planId : null,
      verifiedAt: typeof parsed.verifiedAt === 'number' ? parsed.verifiedAt : null,
    };
  } catch {
    return FREE_SUBSCRIPTION_STATUS;
  }
}

export async function writeCachedSubscriptionStatus(userId: string, status: SubscriptionStatus) {
  try {
    await AsyncStorage.setItem(getStatusStorageKey(userId), JSON.stringify(status));
  } catch (error) {
    console.warn('Failed to cache subscription status', error);
  }
}

export async function clearCachedSubscriptionStatus(userId: string) {
  try {
    await AsyncStorage.removeItem(getStatusStorageKey(userId));
  } catch (error) {
    console.warn('Failed to clear subscription status', error);
  }
}

const BILLING_NOT_CONFIGURED_MESSAGE =
  'In-app purchases are not set up yet. Connect a billing SDK and create the store products to enable Eazee Pro.';

/**
 * No store billing SDK is installed yet, so purchases cannot complete. Replace
 * these two bodies with the billing SDK calls once the products exist in App
 * Store Connect and Play Console - the paywall already speaks this contract.
 */
export function isBillingConfigured() {
  return false;
}

export async function purchaseSubscription(planId: SubscriptionPlanId): Promise<BillingOutcome> {
  if (!isBillingConfigured()) {
    return { status: 'unavailable', message: BILLING_NOT_CONFIGURED_MESSAGE };
  }

  return { status: 'unavailable', message: `No purchase handler for ${planId}` };
}

export async function restorePurchases(): Promise<BillingOutcome> {
  if (!isBillingConfigured()) {
    return { status: 'unavailable', message: BILLING_NOT_CONFIGURED_MESSAGE };
  }

  return { status: 'unavailable', message: 'No restore handler' };
}
