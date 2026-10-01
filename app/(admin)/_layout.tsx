import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { LoadingState } from '@/components/SimpleScreen';
import { readIsAdmin } from '@/lib/userRole';
import { useServerData } from '@/lib/useServerData';
import { useAuthSession } from '../context/AuthSessionContext';

/**
 * Client-side guard for every admin screen: no `admin` claim, no admin UI. The
 * server checks the claim again on every admin request, so this only keeps
 * customers from seeing screens they could not load anyway.
 */
export default function AdminLayout() {
  const { user, isLoading: isAuthLoading } = useAuthSession();
  const role = useServerData(() => readIsAdmin(user), user?.uid ?? 'signed-out');

  if (!isAuthLoading && !user) return <Redirect href="/" />;
  if (isAuthLoading || role.isLoading) return <LoadingState label="Checking access..." />;
  if (role.data !== true) return <Redirect href="/(tabs)/chat" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
