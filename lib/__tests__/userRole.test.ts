import {
  getPostLoginRoute,
  isStaffRole,
  isSuperAdminRole,
  needsRoleChoice,
  readRoleClaim,
  readUserRole,
} from '@/lib/userRole';

const userWithClaims = (claims: Record<string, unknown>) => ({
  getIdTokenResult: jest.fn(async () => ({ claims } as any)),
});

describe('readUserRole', () => {
  it('reads the three roles from the role claim set by the server', async () => {
    await expect(readUserRole(userWithClaims({ role: 'superAdmin' }))).resolves.toBe('superAdmin');
    await expect(readUserRole(userWithClaims({ role: 'admin' }))).resolves.toBe('admin');
    await expect(readUserRole(userWithClaims({}))).resolves.toBe('customer');
    await expect(readUserRole(null)).resolves.toBe('customer');
  });

  it('never grants a role from anything but a known role value', async () => {
    await expect(readUserRole(userWithClaims({ admin: true }))).resolves.toBe('customer');
    await expect(readUserRole(userWithClaims({ role: 'owner' }))).resolves.toBe('customer');
    expect(readRoleClaim('SUPERADMIN')).toBe('customer');
  });

  it('refreshes the token so a newly granted or removed role is seen', async () => {
    const user = userWithClaims({ role: 'admin' });
    await readUserRole(user);
    expect(user.getIdTokenResult).toHaveBeenCalledWith(true);
  });

  it('treats a failed or slow check as a customer, so sign-in never hangs', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(readUserRole({ getIdTokenResult: jest.fn(async () => { throw new Error('offline'); }) })).resolves.toBe('customer');

    jest.useFakeTimers();
    const pending = readUserRole({ getIdTokenResult: jest.fn(() => new Promise<never>(() => {})) });
    jest.advanceTimersByTime(4000);
    await expect(pending).resolves.toBe('customer');
    jest.useRealTimers();
  });
});

describe('routing by role', () => {
  it('sends admins and the super admin to the chooser after login, and customers to the AI chat', () => {
    expect(getPostLoginRoute('superAdmin')).toBe('/role-chooser');
    expect(getPostLoginRoute('admin')).toBe('/role-chooser');
    expect(getPostLoginRoute('customer')).toBe('/(tabs)/chat');
  });

  it('shows staff the chooser on every cold start until they choose, and never shows it to customers', () => {
    // A cold start with a saved session begins with nothing chosen this launch.
    expect(needsRoleChoice('superAdmin', false)).toBe(true);
    expect(needsRoleChoice('admin', false)).toBe(true);
    expect(needsRoleChoice('admin', true)).toBe(false);
    expect(needsRoleChoice('customer', false)).toBe(false);
    expect(needsRoleChoice(null, false)).toBe(false);
  });

  it('knows which roles are staff and which can manage roles', () => {
    expect([isStaffRole('superAdmin'), isStaffRole('admin'), isStaffRole('customer')]).toEqual([true, true, false]);
    expect([isSuperAdminRole('superAdmin'), isSuperAdminRole('admin')]).toEqual([true, false]);
  });
});
