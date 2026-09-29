jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { store.delete(key); }),
  };
});

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
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.updated = [];
  mockListeners.error = [];
});

describe('purchaseSubscription', () => {
  it('buys the plan through the App Store and finishes the transaction', async () => {
    const result = purchaseSubscription('yearly');
    await flush();

    expect(mockIap.requestPurchase).toHaveBeenCalledWith({ request: { apple: { sku: YEARLY_SKU } }, type: 'subs' });
    mockListeners.updated.forEach((listener) => listener({ productId: YEARLY_SKU }));

    await expect(result).resolves.toEqual({ status: 'success', planId: 'yearly' });
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase: { productId: YEARLY_SKU }, isConsumable: false });
    expect(mockListeners.updated).toHaveLength(0);
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
  it('restores an active subscription', async () => {
    mockIap.getActiveSubscriptions.mockResolvedValueOnce([{ productId: YEARLY_SKU, isActive: true }]);

    await expect(restorePurchases()).resolves.toEqual({ status: 'success', planId: 'yearly' });
  });

  it('says so when this Apple ID has no subscription', async () => {
    await expect(restorePurchases()).resolves.toEqual({
      status: 'unavailable',
      message: 'No active Eazee Pro subscription was found for this Apple ID.',
    });
  });

  it('turns Pro off once the App Store no longer reports the subscription', async () => {
    mockIap.getActiveSubscriptions.mockResolvedValueOnce([{ productId: YEARLY_SKU, isActive: true }]);
    await syncStoreSubscriptionStatus('user-1');
    expect(await readCachedSubscriptionStatus('user-1')).toMatchObject({ isPro: true, planId: 'yearly' });

    await syncStoreSubscriptionStatus('user-1');
    expect(await readCachedSubscriptionStatus('user-1')).toMatchObject({ isPro: false, planId: null });
  });

  it('keeps the cached status when the App Store cannot be reached', async () => {
    mockIap.getActiveSubscriptions.mockResolvedValueOnce([{ productId: YEARLY_SKU, isActive: true }]);
    await syncStoreSubscriptionStatus('user-2');
    mockIap.getActiveSubscriptions.mockRejectedValueOnce(new Error('offline'));

    await syncStoreSubscriptionStatus('user-2');
    expect(await readCachedSubscriptionStatus('user-2')).toMatchObject({ isPro: true, planId: 'yearly' });
  });
});
