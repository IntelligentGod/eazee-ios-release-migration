import type { ReactNode } from 'react';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** A plain light screen with a back button, for account and admin pages. */
export default function SimpleScreen({
  title,
  subtitle,
  right,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center border-b border-gray-200 bg-white px-2 py-2">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="h-10 w-10 items-center justify-center"
        >
          <MaterialCommunityIcons name="chevron-left" size={30} color="#0F5A4D" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text className="text-xs text-gray-500" numberOfLines={1}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      <View className="flex-1" style={{ paddingBottom: insets.bottom }}>{children}</View>
    </View>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-6">
      <ActivityIndicator color="#0F5A4D" />
      <Text className="text-sm text-gray-500">{label}</Text>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-6">
      <Text className="text-center text-sm text-gray-700">{error.message}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={onRetry} className="rounded-full bg-[#0F5A4D] px-5 py-2">
        <Text className="font-semibold text-white">Try again</Text>
      </TouchableOpacity>
    </View>
  );
}
