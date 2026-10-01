import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import OnboardingScaffold from '@/components/onboarding/OnboardingScaffold';
import { LoadingState } from '@/components/SimpleScreen';
import { isStaffRole, isSuperAdminRole } from '@/lib/userRole';
import { useAuthSession } from './context/AuthSessionContext';
import { useRoleSession } from './context/RoleSessionContext';

function ChoiceButton({
  icon,
  title,
  description,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.85}
      onPress={onPress}
      className="flex-row items-center rounded-3xl bg-white px-5 py-5 shadow-sm"
    >
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#0F5A4D]">
        <MaterialCommunityIcons name={icon} size={26} color="#FFFFFF" />
      </View>
      <View className="ml-4 flex-1">
        <Text className="text-lg font-bold text-[#0F5A4D]">{title}</Text>
        <Text className="mt-0.5 text-sm text-gray-600">{description}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={26} color="#0F5A4D" />
    </TouchableOpacity>
  );
}

/** Shown to admins and the super admin after every sign-in and app launch; customers never see it. */
export default function RoleChooserScreen() {
  const { user, isLoading: isAuthLoading } = useAuthSession();
  const { role, isResolving, markRoleChosen } = useRoleSession();

  if (!isAuthLoading && !user) return <Redirect href="/" />;
  if (isResolving) return <OnboardingScaffold><LoadingState /></OnboardingScaffold>;
  if (!isStaffRole(role)) return <Redirect href="/(tabs)/chat" />;

  const open = (destination: '/admin' | '/(tabs)/chat') => {
    markRoleChosen();
    router.replace(destination);
  };

  return (
    <OnboardingScaffold>
      <View className="flex-1 justify-center gap-4">
        <Text className="text-center text-3xl font-black text-[#0B7A69]">Welcome back</Text>
        <Text className="mb-4 text-center text-sm font-semibold text-[#0B7A69]">
          {isSuperAdminRole(role) ? 'Signed in as Super Admin' : 'Signed in as Admin'}
        </Text>
        <ChoiceButton
          icon="shield-account-outline"
          title="Admin panel"
          description={isSuperAdminRole(role)
            ? 'Users and roles, purchases, income, products and limits'
            : 'Users, purchases, income, products and limits'}
          onPress={() => open('/admin')}
        />
        <ChoiceButton
          icon="chat-processing-outline"
          title="User app"
          description="Use Eazee as a customer"
          onPress={() => open('/(tabs)/chat')}
        />
      </View>
    </OnboardingScaffold>
  );
}
