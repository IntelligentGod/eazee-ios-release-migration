import { getPostLoginRoute, readIsAdmin } from '@/lib/userRole';

const userWithClaims = (claims: Record<string, unknown>) => ({
  getIdTokenResult: jest.fn(async () => ({ claims } as any)),
});

describe('readIsAdmin', () => {
  it('is true only for the admin custom claim set by the server', async () => {
    await expect(readIsAdmin(userWithClaims({ admin: true }))).resolves.toBe(true);
    await expect(readIsAdmin(userWithClaims({ admin: 'true' }))).resolves.toBe(false);
    await expect(readIsAdmin(userWithClaims({}))).resolves.toBe(false);
    await expect(readIsAdmin(null)).resolves.toBe(false);
  });

  it('refreshes the token so a newly granted role is seen', async () => {
    const user = userWithClaims({ admin: true });
    await readIsAdmin(user);
    expect(user.getIdTokenResult).toHaveBeenCalledWith(true);
  });

  it('treats a failed or slow check as a customer, so sign-in never hangs', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(readIsAdmin({ getIdTokenResult: jest.fn(async () => { throw new Error('offline'); }) })).resolves.toBe(false);

    jest.useFakeTimers();
    const pending = readIsAdmin({ getIdTokenResult: jest.fn(() => new Promise<never>(() => {})) });
    jest.advanceTimersByTime(4000);
    await expect(pending).resolves.toBe(false);
    jest.useRealTimers();
  });
});

describe('getPostLoginRoute', () => {
  it('sends admins to the chooser and customers straight to the AI chat', () => {
    expect(getPostLoginRoute(true)).toBe('/role-chooser');
    expect(getPostLoginRoute(false)).toBe('/(tabs)/chat');
  });
});
