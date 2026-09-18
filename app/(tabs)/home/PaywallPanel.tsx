import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import ScreenHeader from '@/components/ScreenHeader';
import LiquidGlassIconButton from '@/components/LiquidGlassIconButton';
import { GuidedTarget } from '@/components/guidance/GuidanceProvider';
import { useTabContext } from '@/app/context/TabContext';
import { getHomeSettingsBackGuidanceTargetId } from '@/lib/navigationHelp';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/lib/legalLinks';
import { useSubscriptionStatus } from '@/lib/useSubscriptionStatus';
import {
  DEFAULT_SUBSCRIPTION_PLAN_ID,
  PLAN_COMPARISON_ROWS,
  SUBSCRIPTION_PLANS,
  TRIAL_DAYS,
  purchaseSubscription,
  restorePurchases,
  writeCachedSubscriptionStatus,
  type ComparisonRow,
  type ComparisonValue,
  type SubscriptionPlan,
  type SubscriptionPlanId,
} from '@/lib/subscription';

const ACCENT = '#1FF5EF';
const HEADLINE_ACCENT = '#74FEFE';
const CTA_FILL = '#9AFCFD';
const CTA_TEXT = '#00312F';
const CHECK_FILL = '#32C8C2';
const TABLE_BORDER = 'rgba(126, 244, 240, 0.22)';

function ComparisonCell({ value }: { value: ComparisonValue }) {
  if (value.kind === 'check') {
    return (
      <View style={styles.checkCircle}>
        <MaterialCommunityIcons name="check" size={15} color="#00312F" />
      </View>
    );
  }

  if (value.kind === 'none') {
    return <Text style={styles.cellDash}>—</Text>;
  }

  return <Text style={styles.cellText}>{value.label}</Text>;
}

function ComparisonTableRow({ row, isLast }: { row: ComparisonRow; isLast: boolean }) {
  return (
    <View style={[styles.tableRow, isLast && styles.tableRowLast]}>
      <View style={styles.featureCell}>
        <View style={styles.iconTile}>
          <MaterialCommunityIcons name={row.icon} size={20} color="#FFFFFF" />
        </View>
        <View style={styles.featureText}>
          <Text style={styles.featureTitle}>{row.title}</Text>
          <Text style={styles.featureDescription}>{row.description}</Text>
        </View>
      </View>

      <View style={styles.valueCell}>
        <ComparisonCell value={row.free} />
      </View>
      <View style={[styles.valueCell, styles.valueCellLast]}>
        <ComparisonCell value={row.pro} />
      </View>
    </View>
  );
}

function ComparisonTable() {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerLabel, styles.featureCell]}>Pro unlocks</Text>
        <Text style={[styles.headerLabel, styles.valueCell]}>Free</Text>
        <Text style={[styles.headerLabel, styles.valueCell, styles.valueCellLast]}>Pro</Text>
      </View>

      {PLAN_COMPARISON_ROWS.map((row, index) => (
        <ComparisonTableRow
          key={row.title}
          row={row}
          isLast={index === PLAN_COMPARISON_ROWS.length - 1}
        />
      ))}
    </View>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: SubscriptionPlan;
  selected: boolean;
  onSelect: (planId: SubscriptionPlanId) => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      activeOpacity={0.85}
      onPress={() => onSelect(plan.id)}
      style={[styles.planCard, selected && styles.planCardSelected]}
    >
      <View style={styles.planTopRow}>
        <Text style={styles.planTitle}>{plan.title}</Text>
        {plan.highlight && (
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>Best Value</Text>
          </View>
        )}
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioDot} />}
        </View>
      </View>

      <View style={styles.planPriceRow}>
        <Text style={styles.planPrice}>{plan.price}</Text>
        <Text style={styles.planPeriod}>{plan.period}</Text>
      </View>

      <Text style={[styles.planCaption, selected && styles.planCaptionSelected]}>
        {plan.caption}
      </Text>
    </TouchableOpacity>
  );
}

export default function PaywallPanel({
  bottomInset,
  userId,
  onBack,
}: {
  bottomInset: number;
  userId?: string | null;
  onBack: () => void;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>(
    DEFAULT_SUBSCRIPTION_PLAN_ID
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const { setTabBarTheme } = useTabContext();
  const { tier, refresh } = useSubscriptionStatus(userId);
  const isPro = tier === 'pro';

  // Tied to mount rather than the back handler so the tab bar always reverts,
  // including when the panel unmounts by switching tabs.
  useEffect(() => {
    setTabBarTheme('pro');
    return () => setTabBarTheme('default');
  }, [setTabBarTheme]);

  const handleContinue = useCallback(async () => {
    setIsProcessing(true);
    try {
      const outcome = await purchaseSubscription(selectedPlanId);

      if (outcome.status === 'success') {
        if (userId) {
          await writeCachedSubscriptionStatus(userId, {
            isPro: true,
            planId: outcome.planId,
            verifiedAt: Date.now(),
          });
        }
        refresh();
        onBack();
        return;
      }

      if (outcome.status === 'unavailable') {
        Alert.alert('Eazee Pro', outcome.message);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [onBack, refresh, selectedPlanId, userId]);

  const handleRestore = useCallback(async () => {
    setIsProcessing(true);
    try {
      const outcome = await restorePurchases();

      if (outcome.status === 'success') {
        if (userId) {
          await writeCachedSubscriptionStatus(userId, {
            isPro: true,
            planId: outcome.planId,
            verifiedAt: Date.now(),
          });
        }
        refresh();
        Alert.alert('Eazee Pro', 'Your subscription has been restored.');
        return;
      }

      if (outcome.status === 'unavailable') {
        Alert.alert('Restore Purchases', outcome.message);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [refresh, userId]);

  const openLink = useCallback((url: string) => {
    void Linking.openURL(url).catch((error) => {
      console.warn('Failed to open legal link', error);
    });
  }, []);

  return (
    <View style={styles.root}>
      <Image
        source={require('../../../assets/images/paywall-bg.png')}
        style={styles.background}
        resizeMode="cover"
      />

      <View style={styles.safeArea}>
        <ScreenHeader
          title="Eazee Pro"
          subtitle="Unlock More Possibilities"
          titleColor="#FFFFFF"
          horizontalPadding={0}
          left={(
            <GuidedTarget
              targetId={getHomeSettingsBackGuidanceTargetId()}
              label="Back"
              localHighlightRadius={999}
              localHighlightInset={4}
            >
              <LiquidGlassIconButton
                debugLabel="home:settings:paywall:back"
                onPress={onBack}
                size={44}
                style={styles.headerButton}
                fallbackTint="light"
                fallbackBackgroundColor="rgba(255, 255, 255, 0.18)"
                fallbackBorderColor="rgba(255, 255, 255, 0.36)"
                hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={38}
                  color="rgba(0, 0, 0, 0.52)"
                />
              </LiquidGlassIconButton>
            </GuidedTarget>
          )}
        />

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>A smarter,</Text>
              <Text style={[styles.heroTitle, styles.heroTitleAccent]}>easier you</Text>
              <Text style={styles.heroSubtitle}>
                Get the most out of Eazee and make every day easier.
              </Text>
            </View>

            <Image
              source={require('../../../assets/images/paywall-robot.png')}
              style={styles.robot}
              resizeMode="contain"
            />
          </View>

          <ComparisonTable />

          {!isPro && (
            <>
              <View style={styles.planRow}>
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    selected={plan.id === selectedPlanId}
                    onSelect={setSelectedPlanId}
                  />
                ))}
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                disabled={isProcessing}
                onPress={handleContinue}
                style={[styles.cta, isProcessing && styles.ctaDisabled]}
              >
                <Text style={styles.ctaText}>Continue with Pro</Text>
                <MaterialCommunityIcons name="arrow-right" size={22} color={CTA_TEXT} />
              </TouchableOpacity>

              <Text style={styles.trialNote}>
                {TRIAL_DAYS}-day free trial  •  Cancel anytime
              </Text>
            </>
          )}

          {isPro && (
            <View style={styles.proBanner}>
              <MaterialCommunityIcons name="crown-outline" size={22} color={CTA_TEXT} />
              <Text style={styles.proBannerText}>You are on Eazee Pro</Text>
            </View>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.7}
            disabled={isProcessing}
            onPress={handleRestore}
            style={styles.restoreButton}
          >
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            By continuing, you agree to our{' '}
            <Text style={styles.legalLink} onPress={() => openLink(TERMS_URL)}>
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text style={styles.legalLink} onPress={() => openLink(PRIVACY_POLICY_URL)}>
              Privacy Policy
            </Text>
            .
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 14,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: 6,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
  },
  heroTitleAccent: {
    color: HEADLINE_ACCENT,
  },
  heroSubtitle: {
    marginTop: 10,
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 14,
    lineHeight: 20,
  },
  robot: {
    width: 190,
    height: 148,
    marginRight: -10,
  },
  table: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: TABLE_BORDER,
    backgroundColor: 'rgba(2, 66, 68, 0.62)',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(14, 95, 97, 0.85)',
  },
  headerLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 62,
    borderBottomWidth: 1,
    borderBottomColor: TABLE_BORDER,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  featureCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18827A',
  },
  featureText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  featureDescription: {
    marginTop: 1,
    color: 'rgba(255, 255, 255, 0.66)',
    fontSize: 11,
    lineHeight: 15,
  },
  valueCell: {
    width: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: TABLE_BORDER,
    alignSelf: 'stretch',
    paddingVertical: 8,
  },
  valueCellLast: {
    width: 88,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CHECK_FILL,
  },
  cellDash: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
  },
  cellText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  planRow: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 12,
  },
  planCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    backgroundColor: 'rgba(1, 47, 51, 0.72)',
  },
  planCardSelected: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(2, 63, 68, 0.9)',
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  planBadge: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: '#93FAFB',
  },
  planBadgeText: {
    color: CTA_TEXT,
    fontSize: 9,
    fontWeight: '800',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: 'auto',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: ACCENT,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  planPrice: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
  },
  planPeriod: {
    marginLeft: 4,
    marginBottom: 2,
    color: 'rgba(255, 255, 255, 0.76)',
    fontSize: 12,
  },
  planCaption: {
    marginTop: 6,
    color: 'rgba(255, 255, 255, 0.68)',
    fontSize: 11,
    lineHeight: 15,
  },
  planCaptionSelected: {
    color: HEADLINE_ACCENT,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    marginTop: 18,
    borderRadius: 28,
    backgroundColor: CTA_FILL,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: CTA_TEXT,
    fontSize: 17,
    fontWeight: '800',
  },
  trialNote: {
    marginTop: 12,
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 13,
    textAlign: 'center',
  },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    marginTop: 18,
    borderRadius: 26,
    backgroundColor: CTA_FILL,
  },
  proBannerText: {
    color: CTA_TEXT,
    fontSize: 16,
    fontWeight: '800',
  },
  restoreButton: {
    marginTop: 14,
    paddingVertical: 6,
    alignItems: 'center',
  },
  restoreText: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  legal: {
    marginTop: 12,
    color: 'rgba(255, 255, 255, 0.62)',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  legalLink: {
    color: 'rgba(255, 255, 255, 0.92)',
    textDecorationLine: 'underline',
  },
});
