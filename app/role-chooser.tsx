import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import OnboardingScaffold from '@/components/onboarding/OnboardingScaffold';
import { LoadingState } from '@/components/SimpleScreen';
import { readIsAdmin } from '@/lib/userRole';
import { useServerData } from '@/lib/useServerData';
import { useAuthSession } from './context/AuthSessionContext';

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

/** Shown after sign-in to admins only; customers go straight to the AI chat. */
export default function RoleChooserScreen() {
  const { user, isLoading: isAuthLoading } = useAuthSession();
  const role = useServerData(() => readIsAdmin(user, false), user?.uid ?? 'signed-out');

  if (!isAuthLoading && !user) return <Redirect href="/" />;
  if (role.isLoading || isAuthLoading) return <OnboardingScaffold><LoadingState /></OnboardingScaffold>;
  if (role.data !== true) return <Redirect href="/(tabs)/chat" />;

  return (
    <OnboardingScaffold>
      <View className="flex-1 justify-center gap-4">
        <Text className="mb-4 text-center text-3xl font-black text-[#0B7A69]">Welcome back</Text>
        <ChoiceButton
          icon="shield-account-outline"
          title="Admin panel"
          description="Users, purchases, income, products and limits"
          onPress={() => router.replace('/admin')}
        />
        <ChoiceButton
          icon="chat-processing-outline"
          title="User app"
          description="Use Eazee as a customer"
          onPress={() => router.replace('/(tabs)/chat')}
        />
      </View>
    </OnboardingScaffold>
  );
}
