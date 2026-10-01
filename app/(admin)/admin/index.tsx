import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, type Href } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import SimpleScreen from '@/components/SimpleScreen';

type Section = {
  href: Href;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  description: string;
};

const SECTIONS: Section[] = [
  { href: '/admin/users', icon: 'account-group-outline', title: 'Users', description: 'Search accounts, plans, purchases and usage' },
  { href: '/admin/purchases', icon: 'receipt', title: 'Purchases', description: 'Every transaction, by product, status and date' },
  { href: '/admin/income', icon: 'chart-bar', title: 'Income', description: 'Estimated revenue and active subscribers' },
  { href: '/admin/products', icon: 'tag-outline', title: 'Subscription products', description: 'App Store prices and display settings' },
  { href: '/admin/limits', icon: 'tune-variant', title: 'Limits and settings', description: 'Free and Pro daily limits' },
];

export default function AdminHomeScreen() {
  return (
    <SimpleScreen title="Admin panel" onBack={() => router.replace('/role-chooser')}>
      <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
        {SECTIONS.map((section) => (
          <TouchableOpacity
            key={section.title}
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={() => router.push(section.href)}
            className="flex-row items-center rounded-2xl border border-gray-200 bg-white p-4"
          >
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-[#E6F4F1]">
              <MaterialCommunityIcons name={section.icon} size={24} color="#0F5A4D" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-bold text-gray-900">{section.title}</Text>
              <Text className="text-sm text-gray-600">{section.description}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.replace('/(tabs)/chat')}
          className="mt-2 items-center rounded-2xl bg-[#0F5A4D] p-4"
        >
          <Text className="font-bold text-white">Open the user app</Text>
        </TouchableOpacity>
      </ScrollView>
    </SimpleScreen>
  );
}
