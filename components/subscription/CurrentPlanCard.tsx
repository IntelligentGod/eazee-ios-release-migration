import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { SubscriptionStatus } from '@/lib/subscription';
import { formatPeriodLabel, isUpgrade, type StoreProduct } from '@/lib/subscriptionProducts';
import { describeSubscriptionStatus } from '@/lib/subscriptionStatusText';

type CurrentPlanCardProps = {
  status: SubscriptionStatus;
  currentProduct?: StoreProduct;
  /** The other plan; the only one offered as a switch. */
  switchProduct?: StoreProduct;
  savingsLabel: string | null;
  isSandboxAccount: boolean;
  isProcessing: boolean;
  onSwitchPlan: (product: StoreProduct) => void;
  onManage: () => void;
  onOpenHistory: () => void;
};

function SwitchPlanButton({
  status,
  product,
  savingsLabel,
  disabled,
  onPress,
}: {
  status: SubscriptionStatus;
  product: StoreProduct;
  savingsLabel: string | null;
  disabled: boolean;
  onPress: () => void;
}) {
  const upgrading = !!status.planId && isUpgrade(status.planId, product.planId);
  const isAlreadyPending = status.pendingPlanId === product.planId;
  const detail = upgrading
    ? [savingsLabel, 'starts now, unused time is credited'].filter(Boolean).join(' · ')
    : 'starts at your next renewal';

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.85}
      disabled={disabled || isAlreadyPending}
      onPress={onPress}
      className={`mt-3 rounded-2xl border border-[#1FF5EF] px-4 py-3 ${disabled || isAlreadyPending ? 'opacity-60' : ''}`}
    >
      <Text className="text-base font-bold text-white">
        {isAlreadyPending
          ? `Switching to ${product.title} at renewal`
          : `${upgrading ? 'Upgrade' : 'Switch'} to ${product.title} · ${product.displayPrice} ${formatPeriodLabel(product)}`}
      </Text>
      {!isAlreadyPending && <Text className="mt-1 text-xs text-[#74FEFE]">{detail}</Text>}
    </TouchableOpacity>
  );
}

/** What a subscriber sees on the paywall: their plan, its status, and what they can change. */
export default function CurrentPlanCard({
  status,
  currentProduct,
  switchProduct,
  savingsLabel,
  isSandboxAccount,
  isProcessing,
  onSwitchPlan,
  onManage,
  onOpenHistory,
}: CurrentPlanCardProps) {
  const statusLine = isSandboxAccount ? null : describeSubscriptionStatus(status);

  return (
    <View className="mt-5">
      <View className="flex-row items-center rounded-[30px] bg-[#9AFCFD] px-5 py-3">
        <MaterialCommunityIcons name="crown-outline" size={22} color="#00312F" />
        <View className="ml-3 flex-1">
          <Text className="text-base font-extrabold text-[#00312F]">You are on Eazee Pro</Text>
          <Text className="mt-0.5 text-[13px] font-semibold text-[#00312F] opacity-80">
            {currentProduct && !isSandboxAccount
              ? `${currentProduct.title} · ${currentProduct.displayPrice} ${formatPeriodLabel(currentProduct)}`
              : 'Complimentary access'}
          </Text>
          {!!statusLine && <Text className="mt-0.5 text-xs text-[#00312F]">{statusLine}</Text>}
        </View>
      </View>

      {!isSandboxAccount && switchProduct && status.state !== 'expired' && status.state !== 'refunded' && (
        <SwitchPlanButton
          status={status}
          product={switchProduct}
          savingsLabel={savingsLabel}
          disabled={isProcessing}
          onPress={() => onSwitchPlan(switchProduct)}
        />
      )}

      <View className="mt-4 flex-row justify-center gap-6">
        {!isSandboxAccount && (
          <TouchableOpacity accessibilityRole="button" onPress={onManage} disabled={isProcessing} className="py-1.5">
            <Text className="text-sm font-semibold text-[#FFD6D6]">Manage or cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity accessibilityRole="button" onPress={onOpenHistory} className="py-1.5">
          <Text className="text-sm font-semibold text-white">Purchase history</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
