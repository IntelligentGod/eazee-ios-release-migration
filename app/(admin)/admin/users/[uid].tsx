import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import SimpleScreen, { ErrorState, LoadingState } from '@/components/SimpleScreen';
import { SectionTitle } from '@/components/admin/AdminControls';
import PurchaseRow from '@/components/subscription/PurchaseRow';
import { adminApi, type AdminUserDetail } from '@/lib/adminApi';
import { formatSubscriptionDate } from '@/lib/subscriptionStatusText';
import { useServerData } from '@/lib/useServerData';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between border-b border-gray-100 px-4 py-2">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="ml-4 flex-1 text-right text-sm font-medium text-gray-900" numberOfLines={2}>{value}</Text>
    </View>
  );
}

const dateOrDash = (value: number | null | undefined) => (value ? formatSubscriptionDate(value) : '-');

function ProfileSection({ detail }: { detail: AdminUserDetail }) {
  const { auth, user } = detail;
  const subscription = user?.subscription;
  return (
    <View className="bg-white">
      <Field label="Email" value={auth?.email || user?.email || '-'} />
      <Field label="Name" value={auth?.displayName || user?.displayName || '-'} />
      <Field label="Sign-in" value={(auth?.providers || user?.providers || []).join(', ') || '-'} />
      <Field label="Created" value={dateOrDash(auth?.createdAt ?? user?.createdAt)} />
      <Field label="Last sign-in" value={dateOrDash(auth?.lastSignInAt)} />
      {auth?.isAdmin && <Field label="Role" value="Admin" />}
      {auth?.disabled && <Field label="Account" value="Disabled" />}
      <Field
        label="Plan"
        value={subscription?.isUnlimitedAccount ? 'Unlimited (test account)' : subscription?.plan ? `Pro ${subscription.plan}` : 'Free'}
      />
      <Field label="Status" value={subscription?.state ?? 'none'} />
      <Field label="Expires" value={dateOrDash(subscription?.expiresAt)} />
      <Field label="Auto-renew" value={subscription?.autoRenew === null || subscription?.autoRenew === undefined ? '-' : subscription.autoRenew ? 'On' : 'Off'} />
      {!!subscription?.environment && <Field label="Environment" value={subscription.environment} />}
    </View>
  );
}

function UsageSection({ usage }: { usage: AdminUserDetail['usage'] }) {
  if (!usage.length) return <Text className="bg-white p-4 text-sm text-gray-500">No usage in the last 7 days.</Text>;
  return (
    <View className="bg-white">
      {usage.map((day) => (
        <View key={day.day} className="border-b border-gray-100 px-4 py-2">
          <Text className="text-sm font-semibold text-gray-900">{day.day}</Text>
          <Text className="text-xs text-gray-600">
            {`${day.aiActions} AI actions · ${Math.round(day.voiceSeconds / 60)} voice min · goals ${day.guidanceGoal} · tasks ${day.guidanceTask} · recipes/skills ${day.guidanceRecipeSkill} · questions ${day.guidanceQuestions}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function AdminUserDetailScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const detail = useServerData(() => adminApi.user(String(uid)), String(uid));

  return (
    <SimpleScreen title={detail.data?.auth?.email || detail.data?.user?.email || 'User'} subtitle={String(uid)}>
      {detail.error ? (
        <ErrorState error={detail.error} onRetry={detail.reload} />
      ) : detail.isLoading || !detail.data ? (
        <LoadingState />
      ) : (
        <ScrollView>
          <SectionTitle>Profile and plan</SectionTitle>
          <ProfileSection detail={detail.data} />
          <SectionTitle>Purchase history</SectionTitle>
          {detail.data.transactions.length
            ? detail.data.transactions.map((purchase) => <PurchaseRow key={purchase.transactionId} purchase={purchase} />)
            : <Text className="bg-white p-4 text-sm text-gray-500">No purchases.</Text>}
          <SectionTitle>Usage</SectionTitle>
          <UsageSection usage={detail.data.usage} />
          <View className="h-8" />
        </ScrollView>
      )}
    </SimpleScreen>
  );
}
