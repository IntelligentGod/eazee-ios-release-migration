import { buildPlanComparisonRows } from '@/lib/subscription';
import { DEFAULT_SUBSCRIPTION_LIMITS, parseSubscriptionLimits } from '@/lib/subscriptionLimits';
import {
  describeSubscriptionStatus,
  formatPrice,
  formatSubscriptionDate,
} from '@/lib/subscriptionStatusText';

const NOW = Date.UTC(2026, 9, 1);
const EXPIRES = Date.UTC(2026, 10, 12);

describe('describeSubscriptionStatus', () => {
  const base = { isPro: true, planId: 'yearly' as const, verifiedAt: NOW, expiresAt: EXPIRES };

  it('says when a cancelled subscription stays active until', () => {
    expect(describeSubscriptionStatus({ ...base, state: 'cancelled', autoRenew: false }, NOW))
      .toBe(`Cancelled, active until ${formatSubscriptionDate(EXPIRES)}`);
  });

  it('shows the renewal date, or a downgrade due at renewal', () => {
    expect(describeSubscriptionStatus({ ...base, state: 'active' }, NOW)).toBe(`Renews ${formatSubscriptionDate(EXPIRES)}`);
    expect(describeSubscriptionStatus({ ...base, state: 'active', pendingPlanId: 'monthly' }, NOW))
      .toBe(`Switches to Monthly on ${formatSubscriptionDate(EXPIRES)}`);
  });

  it('reads a passed expiry as expired even if the cached state is older', () => {
    expect(describeSubscriptionStatus({ ...base, state: 'cancelled' }, EXPIRES + 1))
      .toBe(`Expired on ${formatSubscriptionDate(EXPIRES)}`);
    expect(describeSubscriptionStatus({ ...base, state: undefined }, NOW)).toBeNull();
  });
});

describe('formatPrice', () => {
  it('formats a price in its currency, and a free trial as such', () => {
    expect(formatPrice(9.99, 'USD')).toMatch(/9\.99/);
    expect(formatPrice(0, 'USD')).toBe('Free trial');
    expect(formatPrice(9.99, 'USD', true)).toBe('Free trial');
    expect(formatPrice(null, null)).toBe('-');
  });
});

describe('plan comparison table', () => {
  const rowFor = (title: string, limits = DEFAULT_SUBSCRIPTION_LIMITS) =>
    buildPlanComparisonRows(limits).find((row) => row.title === title)!;

  it('shows the free limits the server reports', () => {
    const limits = { ...DEFAULT_SUBSCRIPTION_LIMITS, free: { ...DEFAULT_SUBSCRIPTION_LIMITS.free, chatMessagesPerDay: 8, voiceMinutesPerDay: 3 } };
    expect(rowFor('AI actions', limits).free).toEqual({ kind: 'text', label: '8 per day' });
    expect(rowFor('Voice input', limits).free).toEqual({ kind: 'text', label: '3 min / day' });
    expect(rowFor('AI actions', limits).pro).toEqual({ kind: 'text', label: 'Unlimited\n(fair use)' });
  });

  it('shows guidance as Pro-only until an admin gives free users some', () => {
    expect(rowFor('Goal & task guidance').free).toEqual({ kind: 'none' });
    expect(rowFor('Goal & task guidance').pro).toEqual({ kind: 'check' });
    const limits = {
      ...DEFAULT_SUBSCRIPTION_LIMITS,
      free: { ...DEFAULT_SUBSCRIPTION_LIMITS.free, guidance: { ...DEFAULT_SUBSCRIPTION_LIMITS.free.guidance, goalGuidance: 2 } },
    };
    expect(rowFor('Goal & task guidance', limits).free).toEqual({ kind: 'text', label: 'Up to 2 / day' });
  });
});

describe('parseSubscriptionLimits', () => {
  it('accepts the server shape and rejects anything incomplete', () => {
    expect(parseSubscriptionLimits(DEFAULT_SUBSCRIPTION_LIMITS)).toEqual(DEFAULT_SUBSCRIPTION_LIMITS);
    expect(parseSubscriptionLimits({ free: DEFAULT_SUBSCRIPTION_LIMITS.free })).toBeNull();
    expect(parseSubscriptionLimits({ ...DEFAULT_SUBSCRIPTION_LIMITS, pro: { ...DEFAULT_SUBSCRIPTION_LIMITS.pro, chatMessagesPerDay: -1 } })).toBeNull();
  });
});
