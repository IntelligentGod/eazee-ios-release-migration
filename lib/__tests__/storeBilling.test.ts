jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { store.delete(key); }),
  };
});
jest.mock('@/config/backend', () => ({ SERVER_URL: 'https://api.test' }));
jest.mock('@/lib/firebaseAppCheck', () => ({ getFirebaseAppCheckHeaders: jest.fn(async () => ({})) }));
jest.mock('@/firebaseConfig', () => ({
  auth: { currentUser: { uid: 'user-1', getIdToken: jest.fn(async () => 'id-token') } },
}));

type Listener = (value: any) => void;
const mockListeners: { updated: Listener[]; error: Listener[] } = { updated: [], error: [] };

// Built inside the factory: imports are hoisted above module-level constants.
jest.mock('expo-iap', () => ({
  initConnection: jest.fn(async () => true),
  fetchProducts: jest.fn(async ({ skus }: { skus: string[] }) => skus.map((id) => ({ id }))),
  requestPurchase: jest.fn(async () => null),
  finishTransaction: jest.fn(async () => undefined),
  getActiveSubscriptions: jest.fn(async (): Promise<any[]> => []),
  restorePurchases: jest.fn(async () => undefined),
  deepLinkToSubscriptions: jest.fn(async () => undefined),
  purchaseUpdatedListener: (listener: Listener) => {
    mockListeners.updated.push(listener);
    return { remove: () => { mockListeners.updated = mockListeners.updated.filter((item) => item !== listener); } };
  },
  purchaseErrorListener: (listener: Listener) => {
    mockListeners.error.push(listener);
    return { remove: () => { mockListeners.error = mockListeners.error.filter((item) => item !== listener); } };
  },
  isUserCancelledError: (error: any) => error?.code === 'user-cancelled',
  getUserFriendlyErrorMessage: (error: any) => String(error?.message || ''),
}));

import { readCachedSubscriptionStatus } from '@/lib/subscription';
import { purchaseSubscription, restorePurchases, syncStoreSubscriptionStatus } from '@/lib/storeBilling';

const mockIap = jest.requireMock('expo-iap') as Record<string, jest.Mock>;
const YEARLY_SKU = 'com.eazee.subscription.pro.yearly';
const ACCOUNT_TOKEN = '11111111-2222-4333-8444-555555555555';
const flush = () => new Promise((resolve) => setImmediate(resolve));

type ServerReply = { status: number; body: unknown };
let verifyReply: ServerReply | Error;
const fetchMock = jest.fn(async (url: string) => {
  if (url.endsWith('/subscriptions/apple/account-token')) {
    return { ok: true, status: 200, json: async () => ({ appAccountToken: ACCOUNT_TOKEN }) };
  }
  if (verifyReply instanceof Error) throw verifyReply;
  const { status, body } = verifyReply;
  return { ok: status >= 200 && status < 300, status, json: async () => body };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.updated = [];
  mockListeners.error = [];
  verifyReply = { status: 200, body: { isPro: true, planId: 'yearly', expiresAt: Date.now() + 1000 } };
  (global as any).fetch = fetchMock;
});

describe('purchaseSubscription', () => {
  it('stamps the purchase with this account, verifies it on the server, then finishes it', async () => {
    const result = purchaseSubscription('yearly');
    await flush();

    expect(mockIap.requestPurchase).toHaveBeenCalledWith({
      request: { apple: { sku: YEARLY_SKU, appAccountToken: ACCOUNT_TOKEN } },
      type: 'subs',
    });
    mockListeners.updated.forEach((listener) => listener({ id: 't-1', productId: YEARLY_SKU, purchaseToken: 'jws' }));

    await expect(result).resolves.toEqual({ status: 'success', planId: 'yearly' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/subscriptions/apple/verify',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ signedTransaction: 'jws' }) })
    );
    expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
    expect(mockListeners.updated).toHaveLength(0);
  });

  it('leaves the transaction unfinished when the server cannot be reached, so it is retried', async () => {
    verifyReply = new Error('offline');
    const result = purchaseSubscription('yearly');
    await flush();
    mockListeners.updated.forEach((listener) => listener({ id: 't-1', productId: YEARLY_SKU, purchaseToken: 'jws' }));

    await expect(result).resolves.toMatchObject({ status: 'unavailable' });
    expect(mockIap.finishTransaction).not.toHaveBeenCalled();
  });

  it('reports a cancel without an error message', async () => {
    const result = purchaseSubscription('monthly');
    await flush();
    mockListeners.error.forEach((listener) => listener({ code: 'user-cancelled' }));

    await expect(result).resolves.toEqual({ status: 'cancelled' });
  });

  it('explains when the product is missing from the App Store', async () => {
    mockIap.fetchProducts.mockResolvedValueOnce([]);

    await expect(purchaseSubscription('yearly')).resolves.toEqual({
      status: 'unavailable',
      message: 'This plan is not available in the App Store right now.',
    });
    expect(mockIap.requestPurchase).not.toHaveBeenCalled();
  });
});

describe('restorePurchases and status sync', () => {
  const activeSubscription = { productId: YEARLY_SKU, isActive: true, purchaseToken: 'jws' };

  it('restores an active subscription the server confirms', async () => {
    mockIap.getActiveSubscriptions.mockResolvedValueOnce([activeSubscription]);

    await expect(restorePurchases()).resolves.toEqual({ status: 'success', planId: 'yearly' });
  });

  it('treats a subscription bought by another Eazee account as free here', async () => {
    mockIap.getActiveSubscriptions.mockResolvedValueOnce([activeSubscription]);
    verifyReply = { status: 403, body: { error: 'Transaction does not belong to this account' } };

    await expect(restorePurchases()).resolves.toEqual({
      status: 'unavailable',
      message: 'No active Eazee Pro subscription was found for this Eazee account and Apple ID.',
    });
  });

  it('turns Pro off once the App Store no longer reports the subscription', async () => {
    mockIap.getActiveSubscriptions.mockResolvedValueOnce([activeSubscription]);
    await syncStoreSubscriptionStatus('user-1');
    expect(await readCachedSubscriptionStatus('user-1')).toMatchObject({ isPro: true, planId: 'yearly' });

    await syncStoreSubscriptionStatus('user-1');
    expect(await readCachedSubscriptionStatus('user-1')).toMatchObject({ isPro: false, planId: null });
  });

  it('keeps the cached status when the server cannot be reached', async () => {
    mockIap.getActiveSubscriptions.mockResolvedValueOnce([activeSubscription]);
    await syncStoreSubscriptionStatus('user-2');
    mockIap.getActiveSubscriptions.mockResolvedValueOnce([activeSubscription]);
    verifyReply = new Error('offline');

    await syncStoreSubscriptionStatus('user-2');
    expect(await readCachedSubscriptionStatus('user-2')).toMatchObject({ isPro: true, planId: 'yearly' });
  });
});
