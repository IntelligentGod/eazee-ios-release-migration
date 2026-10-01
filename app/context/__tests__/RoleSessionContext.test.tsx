import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

let mockAuthState: { user: any; isLoading: boolean } = { user: null, isLoading: true };
jest.mock('../AuthSessionContext', () => ({
  useAuthSession: () => mockAuthState,
}));

import { RoleSessionProvider, useRoleSession } from '../RoleSessionContext';

const userWithRole = (uid: string, role?: string) => ({
  uid,
  getIdTokenResult: jest.fn(async () => ({ claims: role ? { role } : {} })),
});

function renderSession() {
  const seen: Array<ReturnType<typeof useRoleSession>> = [];
  function Probe() {
    seen.push(useRoleSession());
    return null;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<RoleSessionProvider><Probe /></RoleSessionProvider>);
  });
  const rerender = () => act(() => {
    renderer.update(<RoleSessionProvider><Probe /></RoleSessionProvider>);
  });
  return { latest: () => seen[seen.length - 1], rerender, unmount: () => renderer.unmount() };
}

const flush = () => act(async () => {
  await Promise.resolve();
});

describe('RoleSessionProvider', () => {
  it('holds the app until a saved session role is known, then asks a super admin to choose', async () => {
    mockAuthState = { user: userWithRole('super', 'superAdmin'), isLoading: false };
    const session = renderSession();
    expect(session.latest().isResolving).toBe(true);
    expect(session.latest().needsRoleChoice).toBe(false);

    await flush();
    expect(session.latest().role).toBe('superAdmin');
    expect(session.latest().needsRoleChoice).toBe(true);

    act(() => session.latest().markRoleChosen());
    expect(session.latest().needsRoleChoice).toBe(false);
    session.unmount();
  });

  it('asks again after a new launch: the choice is never persisted', async () => {
    mockAuthState = { user: userWithRole('admin-1', 'admin'), isLoading: false };
    const firstLaunch = renderSession();
    await flush();
    act(() => firstLaunch.latest().markRoleChosen());
    firstLaunch.unmount();

    const secondLaunch = renderSession();
    await flush();
    expect(secondLaunch.latest().needsRoleChoice).toBe(true);
    secondLaunch.unmount();
  });

  it('lets customers straight through, and re-checks the role when another account signs in', async () => {
    mockAuthState = { user: userWithRole('carol'), isLoading: false };
    const session = renderSession();
    await flush();
    expect(session.latest()).toMatchObject({ role: 'customer', isResolving: false, needsRoleChoice: false });

    mockAuthState = { user: userWithRole('admin-2', 'admin'), isLoading: false };
    session.rerender();
    expect(session.latest().isResolving).toBe(true);
    await flush();
    expect(session.latest()).toMatchObject({ role: 'admin', needsRoleChoice: true });
    session.unmount();
  });
});
