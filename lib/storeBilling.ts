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

import { SERVER_URL } from '@/config/backend';
import { auth } from '@/firebaseConfig';
import { getFirebaseAppCheckHeaders } from '@/lib/firebaseAppCheck';
import {
  FREE_SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PLANS,
  writeCachedSubscriptionStatus,
  type BillingOutcome,
  type SubscriptionPlanId,
  type SubscriptionStatus,
} from '@/lib/subscription';

/** The server refused the transaction: it was bought by a different Eazee account. */
class OtherAccountSubscriptionError extends Error {}

async function subscriptionApiRequest(path: string, init: { method: 'GET' | 'POST'; body?: unknown }) {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  if (!idToken) {
    throw new Error('Sign in to manage Eazee Pro');
  }
  const response = await fetch(`${SERVER_URL}/subscriptions${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...await getFirebaseAppCheckHeaders(),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = await response.json().catch(() => null);
  if (response.status === 403) {
    throw new OtherAccountSubscriptionError('This App Store subscription belongs to another Eazee account.');
  }
  if (!response.ok) {
    throw new Error(typeof body?.error === 'string' ? body.error : 'Could not reach Eazee');
  }
  return body;
}

/** Ties a purchase to this Eazee account, so another account on the same Apple ID cannot use it. */
async function fetchAppAccountToken(): Promise<string> {
  const body = await subscriptionApiRequest('/apple/account-token', { method: 'GET' });
  if (typeof body?.appAccountToken !== 'string') {
    throw new Error('Could not prepare the purchase');
  }
  return body.appAccountToken;
}

/**
 * The server checks Apple's signature, the app, the plan, and that this account
 * bought it, then records Pro on the account. Its answer is the source of truth.
 */
async function verifyTransactionWithServer(signedTransaction: string): Promise<SubscriptionStatus> {
  const body = await subscriptionApiRequest('/apple/verify', { method: 'POST', body: { signedTransaction } });
  // New ID tokens carry the Pro claim the server just set, for its own Pro checks.
  await auth.currentUser?.getIdToken(true).catch(() => null);
  const planId = body?.planId === 'monthly' || body?.planId === 'yearly' ? body.planId : null;
  return body?.isPro === true && planId
    ? { isPro: true, planId, verifiedAt: Date.now() }
    : { ...FREE_SUBSCRIPTION_STATUS, verifiedAt: Date.now() };
}

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

  let appAccountToken: string;
  try {
    await ensureStoreConnection();
    const products = await fetchProducts({ skus: [sku], type: 'subs' });
    if (!products?.length) {
      return { status: 'unavailable', message: 'This plan is not available in the App Store right now.' };
    }
    appAccountToken = await fetchAppAccountToken();
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
      void handleStoreTransaction(purchase)
        .then((status) => settle(
          status.isPro && status.planId
            ? { status: 'success', planId: status.planId }
            : { status: 'unavailable', message: 'The App Store did not confirm an active subscription.' }
        ))
        .catch((error) => settle(
          error instanceof OtherAccountSubscriptionError
            ? { status: 'unavailable', message: error.message }
            : {
              status: 'unavailable',
              message: 'Your purchase went through, but Eazee could not confirm it yet. It will be applied automatically when you are back online.',
            }
        ));
    });
    const errorSubscription = purchaseErrorListener((error) => settle(toFailureOutcome(error)));

    requestPurchase({ request: { apple: { sku, appAccountToken } }, type: 'subs' })
      .catch((error) => settle(toFailureOutcome(error)));
  });
}

/**
 * Verifies a StoreKit transaction with the server, then finishes it. A
 * transaction that could not be verified (e.g. offline) is left unfinished, so
 * StoreKit delivers it again at the next launch and it is retried.
 */
function handleStoreTransaction(purchase: Purchase): Promise<SubscriptionStatus> {
  // The purchase flow and the app-wide listener both receive a new purchase; verify it once.
  const key = purchase.id || purchase.purchaseToken || '';
  const inFlight = transactionsInFlight.get(key);
  if (inFlight) return inFlight;
  const handling = verifyAndFinishTransaction(purchase).finally(() => transactionsInFlight.delete(key));
  transactionsInFlight.set(key, handling);
  return handling;
}

const transactionsInFlight = new Map<string, Promise<SubscriptionStatus>>();

async function verifyAndFinishTransaction(purchase: Purchase): Promise<SubscriptionStatus> {
  if (!purchase.purchaseToken) {
    throw new Error('The App Store transaction has no signed data');
  }
  try {
    const status = await verifyTransactionWithServer(purchase.purchaseToken);
    await finishTransaction({ purchase, isConsumable: false });
    return status;
  } catch (error) {
    if (error instanceof OtherAccountSubscriptionError) {
      // Valid for its own account; finishing it stops StoreKit replaying it here.
      await finishTransaction({ purchase, isConsumable: false }).catch(() => {});
    }
    throw error;
  }
}

/**
 * This account's Pro status: StoreKit's active subscription on this Apple ID, as
 * confirmed by the server. A subscription bought by another Eazee account counts as free here.
 */
async function readActiveStoreSubscription(): Promise<SubscriptionStatus> {
  await ensureStoreConnection();
  const subscriptions = await getActiveSubscriptions(PRODUCT_IDS);
  const active = subscriptions.find((subscription) => subscription.isActive && getPlanIdForProduct(subscription.productId));
  if (!active?.purchaseToken) {
    return { ...FREE_SUBSCRIPTION_STATUS, verifiedAt: Date.now() };
  }
  try {
    return await verifyTransactionWithServer(active.purchaseToken);
  } catch (error) {
    if (error instanceof OtherAccountSubscriptionError) {
      return { ...FREE_SUBSCRIPTION_STATUS, verifiedAt: Date.now() };
    }
    throw error;
  }
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
      : { status: 'unavailable', message: 'No active Eazee Pro subscription was found for this Eazee account and Apple ID.' };
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
      void handleStoreTransaction(purchase)
        .catch((error) => console.warn('Could not verify App Store transaction:', error))
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
