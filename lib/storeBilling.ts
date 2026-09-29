import { Platform } from 'react-native';
import {
  deepLinkToSubscriptions,
  fetchProducts,
  finishTransaction,
  getActiveSubscriptions,
  getUserFriendlyErrorMessage,
  initConnection,
  isUserCancelledError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases as restoreStorePurchases,
  type Purchase,
} from 'expo-iap';

import {
  FREE_SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PLANS,
  writeCachedSubscriptionStatus,
  type BillingOutcome,
  type SubscriptionPlanId,
  type SubscriptionStatus,
} from '@/lib/subscription';

/** Eazee Pro is sold through the App Store only for now. */
export const isBillingConfigured = () => Platform.OS === 'ios';

const NOT_AVAILABLE_MESSAGE = 'Eazee Pro can be purchased on iPhone through the App Store.';
const PRODUCT_IDS = SUBSCRIPTION_PLANS.map((plan) => plan.productId);

const getPlanIdForProduct = (productId?: string | null): SubscriptionPlanId | null =>
  SUBSCRIPTION_PLANS.find((plan) => plan.productId === productId)?.id ?? null;

let connectionPromise: Promise<boolean> | null = null;

/** One StoreKit connection for the app's lifetime; a failed attempt is retried on the next call. */
function ensureStoreConnection() {
  if (!connectionPromise) {
    connectionPromise = initConnection().catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
}

const toFailureOutcome = (error: unknown): BillingOutcome =>
  isUserCancelledError(error)
    ? { status: 'cancelled' }
    : { status: 'unavailable', message: getUserFriendlyErrorMessage(error as any) || 'The purchase could not be completed.' };

/**
 * Buys a plan and resolves once StoreKit reports the result. The purchase result
 * arrives on expo-iap's listeners, not from requestPurchase's return value.
 */
export async function purchaseSubscription(planId: SubscriptionPlanId): Promise<BillingOutcome> {
  if (!isBillingConfigured()) {
    return { status: 'unavailable', message: NOT_AVAILABLE_MESSAGE };
  }

  const sku = SUBSCRIPTION_PLANS.find((plan) => plan.id === planId)?.productId;
  if (!sku) {
    return { status: 'unavailable', message: 'This plan is not available.' };
  }

  try {
    await ensureStoreConnection();
    const products = await fetchProducts({ skus: [sku], type: 'subs' });
    if (!products?.length) {
      return { status: 'unavailable', message: 'This plan is not available in the App Store right now.' };
    }
  } catch (error) {
    return toFailureOutcome(error);
  }

  return new Promise<BillingOutcome>((resolve) => {
    let settled = false;
    const settle = (outcome: BillingOutcome) => {
      if (settled) return;
      settled = true;
      updatedSubscription.remove();
      errorSubscription.remove();
      resolve(outcome);
    };

    const updatedSubscription = purchaseUpdatedListener((purchase: Purchase) => {
      if (purchase.productId !== sku) return;
      // Subscriptions are finished right away; there is no server receipt check yet.
      void finishTransaction({ purchase, isConsumable: false })
        .catch((error) => console.warn('Could not finish App Store transaction:', error))
        .finally(() => settle({ status: 'success', planId }));
    });
    const errorSubscription = purchaseErrorListener((error) => settle(toFailureOutcome(error)));

    requestPurchase({ request: { apple: { sku } }, type: 'subs' }).catch((error) => settle(toFailureOutcome(error)));
  });
}

/** The user's active Eazee Pro subscription according to StoreKit, or null when there is none. */
async function readActiveStoreSubscription(): Promise<SubscriptionStatus> {
  await ensureStoreConnection();
  const subscriptions = await getActiveSubscriptions(PRODUCT_IDS);
  const active = subscriptions.find((subscription) => subscription.isActive && getPlanIdForProduct(subscription.productId));
  return active
    ? { isPro: true, planId: getPlanIdForProduct(active.productId), verifiedAt: Date.now() }
    : { ...FREE_SUBSCRIPTION_STATUS, verifiedAt: Date.now() };
}

export async function restorePurchases(): Promise<BillingOutcome> {
  if (!isBillingConfigured()) {
    return { status: 'unavailable', message: NOT_AVAILABLE_MESSAGE };
  }

  try {
    await ensureStoreConnection();
    await restoreStorePurchases();
    const status = await readActiveStoreSubscription();
    return status.isPro && status.planId
      ? { status: 'success', planId: status.planId }
      : { status: 'unavailable', message: 'No active Eazee Pro subscription was found for this Apple ID.' };
  } catch (error) {
    return toFailureOutcome(error);
  }
}

/**
 * Refreshes the cached Pro status from StoreKit, so renewals, cancellations and
 * expirations are picked up. A failed check keeps the cached status, so being
 * offline never takes Pro away.
 */
export async function syncStoreSubscriptionStatus(userId: string) {
  if (!isBillingConfigured()) return;
  try {
    await writeCachedSubscriptionStatus(userId, await readActiveStoreSubscription());
  } catch (error) {
    console.warn('Could not check the App Store subscription:', error);
  }
}

/**
 * StoreKit replays unfinished transactions at launch (e.g. a purchase interrupted
 * by the app closing, or a renewal); finishing them keeps them from replaying forever.
 */
export function listenForStoreTransactions(onTransaction: () => void) {
  if (!isBillingConfigured()) return () => {};
  void ensureStoreConnection().catch((error) => console.warn('Could not connect to the App Store:', error));
  try {
    const subscription = purchaseUpdatedListener((purchase: Purchase) => {
      if (!getPlanIdForProduct(purchase.productId)) return;
      void finishTransaction({ purchase, isConsumable: false })
        .catch(() => {})
        .finally(onTransaction);
    });
    return () => subscription.remove();
  } catch (error) {
    // A build made before expo-iap was added has no native module; purchases then report it instead of crashing here.
    console.warn('App Store purchases are unavailable in this build:', error);
    return () => {};
  }
}

/** Apple's own manage-subscriptions sheet, where the user can cancel or switch plans. */
export async function openStoreSubscriptionManagement() {
  await deepLinkToSubscriptions();
}
