import type { ReactNode } from 'react';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthSession } from '@/app/context/AuthSessionContext';
import { useRoleSession } from '@/app/context/RoleSessionContext';

/**
 * Wraps the user app. Until the signed-in account's role is known nothing is
 * shown, and admins and the super admin are sent to the chooser until they
 * have picked a destination this launch, however they arrived here.
 */
export default function RoleChoiceGate({ children }: { children: ReactNode }) {
  const { user } = useAuthSession();
  const { isResolving, needsRoleChoice } = useRoleSession();

  if (user && isResolving) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#AEFFE8' }}>
        <ActivityIndicator color="#0F5A4D" />
      </View>
    );
  }
  if (needsRoleChoice) return <Redirect href="/role-chooser" />;
  return <>{children}</>;
}
