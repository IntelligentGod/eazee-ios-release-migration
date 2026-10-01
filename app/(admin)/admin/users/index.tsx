import React, { useState } from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import SimpleScreen, { ErrorState, LoadingState } from '@/components/SimpleScreen';
import { adminApi, type AdminUser } from '@/lib/adminApi';
import { formatSubscriptionDate } from '@/lib/subscriptionStatusText';
import { usePagedServerData } from '@/lib/usePagedServerData';

const STATE_LABELS: Record<AdminUser['subscription']['state'], string> = {
  none: 'Free',
  active: 'Active',
  cancelled: 'Cancelled',
  billing_retry: 'Billing issue',
  expired: 'Expired',
  refunded: 'Refunded',
};

function UserRow({ user }: { user: AdminUser }) {
  const { subscription } = user;
  const plan = subscription.isUnlimitedAccount ? 'Unlimited (test)' : subscription.plan ? `Pro ${subscription.plan}` : 'Free';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/admin/users/[uid]', params: { uid: user.uid } })}
      className="border-b border-gray-200 bg-white px-4 py-3"
    >
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-base font-semibold text-gray-900" numberOfLines={1}>
          {user.email || user.displayName || user.uid}
        </Text>
        <Text className="ml-2 text-sm font-semibold text-[#0F5A4D]">{plan}</Text>
      </View>
      <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
        {[
          user.displayName,
          user.providers.join(', ') || 'unknown provider',
          user.createdAt ? `joined ${formatSubscriptionDate(user.createdAt)}` : null,
          subscription.plan ? STATE_LABELS[subscription.state] : null,
          subscription.expiresAt ? `until ${formatSubscriptionDate(subscription.expiresAt)}` : null,
        ].filter(Boolean).join(' · ')}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminUsersScreen() {
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const users = usePagedServerData<AdminUser>(
    async (cursor) => {
      const page = await adminApi.users({ search: submittedSearch || undefined, cursor });
      return { items: page.users, nextCursor: page.nextCursor };
    },
    submittedSearch
  );

  return (
    <SimpleScreen title="Users">
      <View className="border-b border-gray-200 bg-white p-3">
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => setSubmittedSearch(search.trim())}
          placeholder="Search by email or uid"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          className="rounded-xl bg-gray-100 px-3 py-2 text-base text-gray-900"
        />
      </View>
      {users.error && !users.items.length ? (
        <ErrorState error={users.error} onRetry={users.reload} />
      ) : users.isLoading && !users.items.length ? (
        <LoadingState />
      ) : (
        <FlatList
          data={users.items}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => <UserRow user={item} />}
          onRefresh={users.reload}
          refreshing={users.isLoading && users.items.length > 0}
          onEndReached={users.loadMore}
          ListEmptyComponent={<Text className="p-8 text-center text-sm text-gray-600">No users found.</Text>}
        />
      )}
    </SimpleScreen>
  );
}
