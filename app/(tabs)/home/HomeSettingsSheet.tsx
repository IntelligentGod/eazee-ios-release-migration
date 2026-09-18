import React, { useCallback, useEffect } from 'react';
import {
  type AccessibilityRole,
  type AccessibilityState,
  Animated,
  BackHandler,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import LiquidGlassIconButton from '@/components/LiquidGlassIconButton';
import LowerSwipeGesture from '@/components/navigation/LowerSwipeGesture';
import { GuidedTarget } from '@/components/guidance/GuidanceProvider';
import PaywallPanel from './PaywallPanel';
import { useSubscriptionStatus } from '@/lib/useSubscriptionStatus';
import {
  getHomeAccountGuidanceTargetId,
  getHomeBackGuidanceTargetId,
  getHomeSettingsBackGuidanceTargetId,
  getHomeSettingsControlGuidanceTargetId,
  getHomeSettingsPanelGuidanceTargetId,
  type NavigationHelpMode,
} from '@/lib/navigationHelp';
import { useLeftHandedMode } from '@/lib/useLeftHandedMode';
import { useNavigationHelpMode } from '@/lib/useNavigationHelpMode';
import {
  AI_BASE_PERSONALIZATION_OPTIONS,
  AI_PERSONALIZATION_LEVEL_OPTIONS,
  AI_RESPONSE_LENGTH_OPTIONS,
  type AiBasePersonalization,
  type AiPersonalizationLevel,
  type AiResponseLength,
} from '@/lib/aiPersonalization';
import { useAiPersonalization } from '@/lib/useAiPersonalization';
import { type HomeCardId } from '@/lib/homePersonalization';
import { useHomePersonalization } from '@/lib/useHomePersonalization';
import {
  isNativeLiquidGlassMenuAvailable,
  LiquidGlassMenu,
} from '@/modules/expo-liquid-glass-menu';
import { startTutorial } from '@/lib/tutorial';
import { PRIVACY_POLICY_URL, SUPPORT_URL, TERMS_URL } from '@/lib/legalLinks';

type HomeSettingsSheetProps = {
  bottomInset: number;
  swipeBandHeight: number;
  userId?: string | null;
  visible: boolean;
  initialFocusPanel?: string;
  initialFocusNonce?: string;
  onClose: () => void;
  onOpenManageAccount: () => void;
};

type HomeSettingsPanel = 'settings' | 'paywall' | 'aiPersonalization' | 'homePersonalization' | 'legalSupport';

const HOME_BACKGROUND_COLORS: [string, string] = ['#F1ECCE', '#8C8268'];
const SETTINGS_ACCENT_ICON_COLOR = '#AEFFE8';
const SETTINGS_ACCENT_ICON_SIZE = 38;

function normalizeHomeSettingsPanel(value?: string): HomeSettingsPanel {
  if (
    value === 'paywall'
    || value === 'aiPersonalization'
    || value === 'homePersonalization'
    || value === 'legalSupport'
  ) {
    return value;
  }
  return 'settings';
}

function SettingsRow({
  icon,
  label,
  targetId,
  disabled,
  onPress,
  right,
  accessibilityRole,
  accessibilityState,
}: {
  icon: React.ReactNode;
  label: string;
  targetId?: string;
  disabled?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
}) {
  const rowContent = (
    <>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
      </View>
      {!!right && <View style={styles.rowRight}>{right}</View>}
    </>
  );

  const row = onPress ? (
    <TouchableOpacity
      activeOpacity={0.76}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, disabled && styles.rowDisabled]}
    >
      {rowContent}
    </TouchableOpacity>
  ) : (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      {rowContent}
    </View>
  );

  if (!targetId) return row;

  return (
    <GuidedTarget
      targetId={targetId}
      label={label}
      localHighlightRadius={22}
      localHighlightShape="rect"
    >
      {row}
    </GuidedTarget>
  );
}

function NavigationModeToggle() {
  const { mode, setMode } = useNavigationHelpMode();
  const options: { value: NavigationHelpMode; label: string }[] = [
    { value: 'guide', label: 'Guided' },
    { value: 'shortcut', label: 'Direct' },
  ];

  return (
    <View style={styles.modeToggle}>
      {options.map((option) => {
        const selected = mode === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!selected) {
                void setMode(option.value);
              }
            }}
            style={[styles.modeOption, selected && styles.modeOptionSelected]}
          >
            <Text style={[styles.modeOptionText, selected && styles.modeOptionTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LeftHandedToggle({ enabled }: { enabled: boolean }) {
  return (
    <View style={[styles.binaryToggle, enabled && styles.binaryToggleActive]}>
      <View style={[styles.binaryToggleKnob, enabled && styles.binaryToggleKnobActive]} />
    </View>
  );
}

type PersonalizationMenuValue = AiBasePersonalization | AiPersonalizationLevel | AiResponseLength;

function PersonalizationMenuPicker<T extends PersonalizationMenuValue>({
  label,
  targetId,
  value,
  options,
  onChange,
}: {
  label: string;
  targetId?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label || 'Default';
  const usesNativeMenu = isNativeLiquidGlassMenuAvailable();

  const content = (
    <View style={styles.baseStyleSetting}>
      <View style={styles.baseStyleRow}>
        <Text style={styles.settingLabel}>{label}</Text>
        {usesNativeMenu ? (
          <LiquidGlassMenu
            accessibilityLabel={`${label}, ${selectedLabel}`}
            onOptionSelected={({ nativeEvent }) => {
              const nextValue = options.find(
                (option) => option.value === nativeEvent.value
              )?.value;
              if (nextValue) {
                onChange(nextValue);
              }
            }}
            options={options}
            selectedValue={value}
            style={styles.baseStyleNativeMenu}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            onPress={() => setIsOpen(true)}
            style={({ pressed }) => [styles.baseStyleBubble, pressed && styles.baseStyleBubblePressed]}
          >
            <Text style={styles.baseStyleBubbleText}>{selectedLabel}</Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color="#4D4A3B" />
          </Pressable>
        )}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={!usesNativeMenu && isOpen}
      >
        <View style={styles.baseStyleModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>

          <LinearGradient
            colors={['#8C8268', '#4D4A3B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.baseStyleModalCard}
          >
            <View style={styles.baseStyleModalHeader}>
              <Text style={styles.baseStyleModalTitle}>{label}</Text>
              <Pressable
                accessibilityLabel={`Close ${label.toLowerCase()} picker`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setIsOpen(false)}
                style={({ pressed }) => [
                  styles.baseStyleModalCloseButton,
                  pressed && styles.baseStyleModalCloseButtonPressed,
                ]}
              >
                <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.baseStyleModalOptions}>
              {options.map((option) => {
                const selected = value === option.value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.baseStyleModalOption,
                      selected && styles.baseStyleModalOptionSelected,
                      pressed && styles.baseStyleModalOptionPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.baseStyleModalOptionText,
                        selected && styles.baseStyleModalOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {selected && (
                      <MaterialCommunityIcons name="check-circle" size={20} color="#4D4A3B" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );

  if (!targetId) return content;

  return (
    <GuidedTarget targetId={targetId} label={label} localHighlightRadius={22} localHighlightShape="rect">
      {content}
    </GuidedTarget>
  );
}

function AiPersonalizationPanel({
  bottomInset,
  userId,
  onBack,
}: {
  bottomInset: number;
  userId?: string | null;
  onBack: () => void;
}) {
  const {
    draft,
    updateDraft,
    save,
    isSaving,
    errorMessage,
    hasChanges,
  } = useAiPersonalization(userId);

  const handleSave = useCallback(() => {
    void save();
  }, [save]);

  return (
    <View style={[styles.safeArea, { paddingBottom: bottomInset + 18 }]}>
      <ScreenHeader
        title="Intelligence Personalization"
        titleColor="#FFFFFF"
        horizontalPadding={0}
        titlePlacement="left"
        titleStyle={styles.personalizationHeaderTitle}
        left={(
          <GuidedTarget
            targetId={getHomeSettingsBackGuidanceTargetId()}
            label="Back"
            localHighlightRadius={999}
            localHighlightInset={4}
          >
            <LiquidGlassIconButton
              debugLabel="home:settings:ai-personalization:back"
              onPress={onBack}
              size={44}
              style={styles.headerButton}
              fallbackTint="light"
              fallbackBackgroundColor="rgba(255, 255, 255, 0.18)"
              fallbackBorderColor="rgba(255, 255, 255, 0.36)"
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            >
              <MaterialCommunityIcons name="chevron-left" size={38} color="rgba(0, 0, 0, 0.52)" />
            </LiquidGlassIconButton>
          </GuidedTarget>
        )}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.personalizationScroll}
        contentContainerStyle={styles.personalizationContent}
      >
        <PersonalizationMenuPicker
          label="Base personalization"
          targetId={getHomeSettingsControlGuidanceTargetId('aiBasePersonalization')}
          value={draft.baseStyle}
          options={AI_BASE_PERSONALIZATION_OPTIONS}
          onChange={(baseStyle) => updateDraft({ baseStyle })}
        />
        <PersonalizationMenuPicker
          label="Emoji"
          targetId={getHomeSettingsControlGuidanceTargetId('aiEmoji')}
          value={draft.emoji}
          options={AI_PERSONALIZATION_LEVEL_OPTIONS}
          onChange={(emoji) => updateDraft({ emoji })}
        />
        <PersonalizationMenuPicker
          label="Response length"
          targetId={getHomeSettingsControlGuidanceTargetId('aiResponseLength')}
          value={draft.responseLength}
          options={AI_RESPONSE_LENGTH_OPTIONS}
          onChange={(responseLength) => updateDraft({ responseLength })}
        />

        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <Pressable
          disabled={!hasChanges || isSaving}
          onPress={handleSave}
          style={[styles.saveButton, (!hasChanges || isSaving) && styles.saveButtonDisabled]}
        >
          <Text style={[styles.saveButtonText, (!hasChanges || isSaving) && styles.saveButtonTextDisabled]}>
            {isSaving ? 'Saving' : hasChanges ? 'Save' : 'Saved'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const HOME_CARD_LABELS: Record<HomeCardId, string> = {
  nextStep: 'Next step',
  suggestions: 'Suggestions',
  todayPlan: "Today's plan",
};

function HomePersonalizationPanel({
  bottomInset,
  onBack,
  userId,
}: {
  bottomInset: number;
  onBack: () => void;
  userId?: string | null;
}) {
  const { settings, setOrder, setSuggestionsEnabled } = useHomePersonalization(userId);

  const moveCard = useCallback((item: HomeCardId, direction: -1 | 1) => {
    const currentIndex = settings.order.indexOf(item);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= settings.order.length) {
      return;
    }

    const nextOrder = [...settings.order];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
    setOrder(nextOrder);
  }, [setOrder, settings.order]);

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<HomeCardId>) => {
    const itemIndex = settings.order.indexOf(item);

    return (
      <GuidedTarget
        targetId={getHomeSettingsControlGuidanceTargetId(
          item === 'nextStep' ? 'homeNextStep' : item === 'suggestions' ? 'homeSuggestions' : 'homeTodayPlan'
        )}
        label={HOME_CARD_LABELS[item]}
        localHighlightRadius={22}
        localHighlightShape="rect"
      >
        <View style={[styles.homeCardOrderRow, isActive && styles.homeCardOrderRowActive]}>
          <TouchableOpacity
            accessibilityActions={[
              ...(itemIndex > 0 ? [{ label: 'Move up', name: 'decrement' as const }] : []),
              ...(itemIndex < settings.order.length - 1 ? [{ label: 'Move down', name: 'increment' as const }] : []),
            ]}
            accessibilityLabel={`${HOME_CARD_LABELS[item]}, position ${itemIndex + 1} of ${settings.order.length}`}
            accessibilityRole="adjustable"
            activeOpacity={0.72}
            disabled={isActive}
            hitSlop={8}
            onAccessibilityAction={({ nativeEvent }) => {
              if (nativeEvent.actionName === 'decrement') {
                moveCard(item, -1);
              } else if (nativeEvent.actionName === 'increment') {
                moveCard(item, 1);
              }
            }}
            onPressIn={drag}
            style={styles.homeCardDragHandle}
          >
            <MaterialCommunityIcons name="drag" size={26} color="rgba(255, 255, 255, 0.82)" />
          </TouchableOpacity>
          <Text style={styles.homeCardOrderLabel}>{HOME_CARD_LABELS[item]}</Text>
          {item === 'suggestions' && (
            <TouchableOpacity
              accessibilityLabel="Show Suggestions on Home"
              accessibilityRole="switch"
              accessibilityState={{ checked: settings.suggestionsEnabled }}
              activeOpacity={0.72}
              hitSlop={8}
              onPress={() => setSuggestionsEnabled(!settings.suggestionsEnabled)}
            >
              <LeftHandedToggle enabled={settings.suggestionsEnabled} />
            </TouchableOpacity>
          )}
        </View>
      </GuidedTarget>
    );
  }, [moveCard, setSuggestionsEnabled, settings.order, settings.suggestionsEnabled]);

  return (
    <View style={[styles.safeArea, { paddingBottom: bottomInset + 18 }]}>
      <ScreenHeader
        title="Home Personalization"
        titleColor="#FFFFFF"
        horizontalPadding={0}
        titlePlacement="left"
        titleStyle={styles.personalizationHeaderTitle}
        left={(
          <GuidedTarget
            targetId={getHomeSettingsBackGuidanceTargetId()}
            label="Back"
            localHighlightRadius={999}
            localHighlightInset={4}
          >
            <LiquidGlassIconButton
              debugLabel="home:settings:home-personalization:back"
              onPress={onBack}
              size={44}
              style={styles.headerButton}
              fallbackTint="light"
              fallbackBackgroundColor="rgba(255, 255, 255, 0.18)"
              fallbackBorderColor="rgba(255, 255, 255, 0.36)"
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            >
              <MaterialCommunityIcons name="chevron-left" size={38} color="rgba(0, 0, 0, 0.52)" />
            </LiquidGlassIconButton>
          </GuidedTarget>
        )}
      />

      <Text style={styles.homePersonalizationHint}>
        Drag the handles to reorder Home cards. Suggestions appear when you have free time in your day.
      </Text>
      <GuidedTarget
        targetId={getHomeSettingsControlGuidanceTargetId('homeReorder')}
        label="Home card reorder"
        localHighlightRadius={22}
        localHighlightShape="rect"
      >
        <DraggableFlatList
          activationDistance={0}
          contentContainerStyle={styles.homeCardOrderList}
          data={settings.order}
          keyExtractor={(item) => item}
          onDragEnd={({ data }) => setOrder(data)}
          renderItem={renderItem}
          scrollEnabled={false}
        />
      </GuidedTarget>
    </View>
  );
}

function LegalSupportPanel({
  bottomInset,
  onBack,
  onOpenLink,
}: {
  bottomInset: number;
  onBack: () => void;
  onOpenLink: (url: string) => void;
}) {
  return (
    <View style={[styles.safeArea, { paddingBottom: bottomInset + 18 }]}>
      <ScreenHeader
        title="Legal & Support"
        titleColor="#FFFFFF"
        horizontalPadding={0}
        titlePlacement="left"
        titleStyle={styles.personalizationHeaderTitle}
        left={(
          <GuidedTarget
            targetId={getHomeSettingsBackGuidanceTargetId()}
            label="Back"
            localHighlightRadius={999}
            localHighlightInset={4}
          >
            <LiquidGlassIconButton
              debugLabel="home:settings:legal-support:back"
              onPress={onBack}
              size={44}
              style={styles.headerButton}
              fallbackTint="light"
              fallbackBackgroundColor="rgba(255, 255, 255, 0.18)"
              fallbackBorderColor="rgba(255, 255, 255, 0.36)"
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            >
              <MaterialCommunityIcons name="chevron-left" size={38} color="rgba(0, 0, 0, 0.52)" />
            </LiquidGlassIconButton>
          </GuidedTarget>
        )}
      />

      <View style={styles.list}>
        <SettingsRow
          icon={<MaterialCommunityIcons name="shield-lock-outline" size={SETTINGS_ACCENT_ICON_SIZE} color={SETTINGS_ACCENT_ICON_COLOR} />}
          label="Privacy Policy"
          targetId={getHomeSettingsControlGuidanceTargetId('privacyPolicy')}
          onPress={() => onOpenLink(PRIVACY_POLICY_URL)}
          right={<MaterialCommunityIcons name="open-in-new" size={24} color="rgba(255, 255, 255, 0.72)" />}
        />
        <SettingsRow
          icon={<MaterialCommunityIcons name="file-document-outline" size={SETTINGS_ACCENT_ICON_SIZE} color={SETTINGS_ACCENT_ICON_COLOR} />}
          label="Terms"
          targetId={getHomeSettingsControlGuidanceTargetId('terms')}
          onPress={() => onOpenLink(TERMS_URL)}
          right={<MaterialCommunityIcons name="open-in-new" size={24} color="rgba(255, 255, 255, 0.72)" />}
        />
        <SettingsRow
          icon={<MaterialCommunityIcons name="lifebuoy" size={SETTINGS_ACCENT_ICON_SIZE} color={SETTINGS_ACCENT_ICON_COLOR} />}
          label="Support"
          targetId={getHomeSettingsControlGuidanceTargetId('support')}
          onPress={() => onOpenLink(SUPPORT_URL)}
          right={<MaterialCommunityIcons name="open-in-new" size={24} color="rgba(255, 255, 255, 0.72)" />}
        />
      </View>
    </View>
  );
}

export default function HomeSettingsSheet({
  bottomInset,
  swipeBandHeight,
  userId,
  visible,
  initialFocusPanel,
  initialFocusNonce,
  onClose,
  onOpenManageAccount,
}: HomeSettingsSheetProps) {
  const isClosingRef = React.useRef(false);
  const screenAnim = React.useRef(new Animated.Value(0)).current;
  const { isLeftHanded, toggleLeftHanded } = useLeftHandedMode();
  const [activePanel, setActivePanel] = React.useState<HomeSettingsPanel>('settings');

  const animateSheet = useCallback((toValue: number, onComplete?: () => void) => {
    Animated.timing(screenAnim, {
      toValue,
      duration: toValue === 1 ? 260 : 200,
      easing: toValue === 1 ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onComplete?.();
      }
    });
  }, [screenAnim]);

  const handleClose = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;
    animateSheet(0, onClose);
  }, [animateSheet, onClose]);

  const handleOpenManageAccount = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;
    onOpenManageAccount();
    animateSheet(0);
  }, [animateSheet, onOpenManageAccount]);

  const handleToggleLeftHanded = useCallback(() => {
    void toggleLeftHanded();
  }, [toggleLeftHanded]);

  const { tier: subscriptionTier } = useSubscriptionStatus(userId);

  const handleOpenPaywall = useCallback(() => {
    setActivePanel('paywall');
  }, []);

  const handleClosePaywall = useCallback(() => {
    setActivePanel('settings');
  }, []);

  const handleOpenAiPersonalization = useCallback(() => {
    setActivePanel('aiPersonalization');
  }, []);

  const handleCloseAiPersonalization = useCallback(() => {
    setActivePanel('settings');
  }, []);

  const handleOpenHomePersonalization = useCallback(() => {
    setActivePanel('homePersonalization');
  }, []);

  const handleOpenLegalSupport = useCallback(() => {
    setActivePanel('legalSupport');
  }, []);

  const handleReplayTutorial = useCallback(() => {
    if (!userId) {
      return;
    }

    void startTutorial(userId).catch((error) => {
      console.warn('Failed to restart tutorial', error);
    });
    handleClose();
    requestAnimationFrame(() => {
      router.push('/(tabs)/chat');
    });
  }, [handleClose, userId]);

  const handleOpenExternalLink = useCallback((url: string) => {
    void Linking.openURL(url).catch((error) => {
      console.warn('Failed to open settings link', error);
    });
  }, []);

  const handleCloseHomePersonalization = useCallback(() => {
    setActivePanel('settings');
  }, []);

  const handleCloseLegalSupport = useCallback(() => {
    setActivePanel('settings');
  }, []);

  const handleHardwareBackPress = useCallback(() => {
    if (activePanel === 'paywall') {
      handleClosePaywall();
      return true;
    }
    if (activePanel === 'aiPersonalization') {
      handleCloseAiPersonalization();
      return true;
    }
    if (activePanel === 'homePersonalization') {
      handleCloseHomePersonalization();
      return true;
    }
    if (activePanel === 'legalSupport') {
      handleCloseLegalSupport();
      return true;
    }

    handleClose();
    return true;
  }, [activePanel, handleClose, handleCloseAiPersonalization, handleCloseHomePersonalization, handleCloseLegalSupport, handleClosePaywall]);

  useEffect(() => {
    if (!visible) {
      isClosingRef.current = false;
      setActivePanel('settings');
      screenAnim.setValue(0);
      return;
    }

    isClosingRef.current = false;
    screenAnim.setValue(0);
    const frame = requestAnimationFrame(() => {
      animateSheet(1);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [animateSheet, screenAnim, visible]);

  useEffect(() => {
    if (!visible) return;
    setActivePanel(normalizeHomeSettingsPanel(initialFocusPanel));
  }, [initialFocusNonce, initialFocusPanel, visible]);

  useEffect(() => {
    if (!visible) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBackPress);

    return () => {
      subscription.remove();
    };
  }, [handleHardwareBackPress, visible]);

  const content = (
    <View style={[styles.safeArea, { paddingBottom: bottomInset + 18 }]}>
      <ScreenHeader
        title="Settings"
        titleColor="#FFFFFF"
        horizontalPadding={0}
        titlePlacement="left"
        left={(
          <GuidedTarget
            targetId={getHomeBackGuidanceTargetId()}
            label="Back"
            localHighlightRadius={999}
            localHighlightInset={4}
          >
            <LiquidGlassIconButton
              debugLabel="home:settings:back"
              onPress={handleClose}
              size={44}
              style={styles.headerButton}
              fallbackTint="light"
              fallbackBackgroundColor="rgba(255, 255, 255, 0.18)"
              fallbackBorderColor="rgba(255, 255, 255, 0.36)"
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            >
              <MaterialCommunityIcons name="chevron-left" size={38} color="rgba(0, 0, 0, 0.52)" />
            </LiquidGlassIconButton>
          </GuidedTarget>
        )}
      />

      <View style={styles.list}>
        <SettingsRow
          icon={<MaterialCommunityIcons name="crown-outline" size={SETTINGS_ACCENT_ICON_SIZE} color={SETTINGS_ACCENT_ICON_COLOR} />}
          label="Eazee Pro"
          targetId={getHomeSettingsControlGuidanceTargetId('eazeePro')}
          onPress={handleOpenPaywall}
          right={(
            <View style={styles.rowRightGroup}>
              <View style={[styles.tierBadge, subscriptionTier === 'pro' && styles.tierBadgePro]}>
                <Text style={[styles.tierBadgeText, subscriptionTier === 'pro' && styles.tierBadgeTextPro]}>
                  {subscriptionTier === 'pro' ? 'Pro' : 'Free'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={28} color="rgba(255, 255, 255, 0.78)" />
            </View>
          )}
        />
        <SettingsRow
          icon={<Text allowFontScaling={false} style={styles.rowEmoji}>🫆</Text>}
          label="Manage Account"
          targetId={getHomeAccountGuidanceTargetId('settings')}
          onPress={handleOpenManageAccount}
        />
        <SettingsRow
          icon={<Text allowFontScaling={false} style={styles.rowEmoji}>🙈</Text>}
          label="Guided Access Mode"
          targetId={getHomeSettingsControlGuidanceTargetId('navigationMode')}
          right={<NavigationModeToggle />}
        />
        <SettingsRow
          icon={(
            <Text
              allowFontScaling={false}
              style={[styles.rowEmoji, isLeftHanded && styles.leftHandedRowEmoji]}
            >
              {'🙋‍♂️'}
            </Text>
          )}
          label="Left Handed Mode"
          targetId={getHomeSettingsControlGuidanceTargetId('leftHanded')}
          onPress={handleToggleLeftHanded}
          accessibilityRole="switch"
          accessibilityState={{ checked: isLeftHanded }}
          right={<LeftHandedToggle enabled={isLeftHanded} />}
        />
        <SettingsRow
          icon={<Text allowFontScaling={false} style={styles.rowEmoji}>✨</Text>}
          label="Intelligence Personalization"
          targetId={getHomeSettingsControlGuidanceTargetId('aiPersonalization')}
          onPress={handleOpenAiPersonalization}
          right={<MaterialCommunityIcons name="chevron-right" size={28} color="rgba(255, 255, 255, 0.78)" />}
        />
        <SettingsRow
          icon={<Text allowFontScaling={false} style={styles.rowEmoji}>🏠</Text>}
          label="Home Personalization"
          targetId={getHomeSettingsControlGuidanceTargetId('homePersonalization')}
          onPress={handleOpenHomePersonalization}
          right={<MaterialCommunityIcons name="chevron-right" size={28} color="rgba(255, 255, 255, 0.78)" />}
        />
        <SettingsRow
          disabled={!userId}
          icon={<MaterialCommunityIcons name="play-circle-outline" size={SETTINGS_ACCENT_ICON_SIZE} color={SETTINGS_ACCENT_ICON_COLOR} />}
          label="Replay Tutorial"
          targetId={getHomeSettingsControlGuidanceTargetId('replayTutorial')}
          onPress={handleReplayTutorial}
          right={<MaterialCommunityIcons name="chevron-right" size={28} color="rgba(255, 255, 255, 0.78)" />}
        />
        <SettingsRow
          icon={<MaterialCommunityIcons name="shield-account-outline" size={SETTINGS_ACCENT_ICON_SIZE} color={SETTINGS_ACCENT_ICON_COLOR} />}
          label="Legal & Support"
          targetId={getHomeSettingsControlGuidanceTargetId('legalSupport')}
          onPress={handleOpenLegalSupport}
          right={<MaterialCommunityIcons name="chevron-right" size={28} color="rgba(255, 255, 255, 0.78)" />}
        />
      </View>
    </View>
  );

  const activeContent = activePanel === 'paywall'
    ? (
        <PaywallPanel
          bottomInset={bottomInset}
          userId={userId}
          onBack={handleClosePaywall}
        />
      )
    : activePanel === 'aiPersonalization'
    ? (
        <AiPersonalizationPanel
          bottomInset={bottomInset}
          userId={userId}
          onBack={handleCloseAiPersonalization}
        />
      )
    : activePanel === 'homePersonalization'
      ? (
          <HomePersonalizationPanel
            bottomInset={bottomInset}
            onBack={handleCloseHomePersonalization}
            userId={userId}
          />
        )
      : activePanel === 'legalSupport'
        ? (
            <LegalSupportPanel
              bottomInset={bottomInset}
              onBack={handleCloseLegalSupport}
              onOpenLink={handleOpenExternalLink}
            />
          )
      : content;

  const sheetTranslateY = screenAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

  const sheetScale = screenAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  return (
    <View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.root, !visible && styles.rootHidden]}
    >
      <Animated.View style={[styles.background, { opacity: screenAnim }]}>
        <LinearGradient
          colors={HOME_BACKGROUND_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View pointerEvents="none" style={styles.waveLayer}>
          <Image
            source={require('../../../assets/images/wave-bg.png')}
            style={styles.waveImage}
            resizeMode="cover"
          />
        </View>
        <LinearGradient
          colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.72)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
          style={styles.shadowLayer}
        />
      </Animated.View>
      {visible && (
        <Animated.View
          style={[
            styles.content,
            {
              opacity: screenAnim,
              transform: [{ translateY: sheetTranslateY }, { scale: sheetScale }],
            },
          ]}
        >
          <GuidedTarget
            targetId={getHomeSettingsPanelGuidanceTargetId()}
            label="Settings"
            highlightMode="overlay"
            style={StyleSheet.absoluteFillObject}
          >
            {activeContent}
          </GuidedTarget>
        </Animated.View>
      )}
      {visible && activePanel === 'settings' && (
        <LowerSwipeGesture
          currentTab="home"
          style={[
            styles.lowerSwipeBand,
            { height: swipeBandHeight },
          ]}
        >
          <View />
        </LowerSwipeGesture>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 120,
    elevation: 120,
  },
  rootHidden: {
    opacity: 0,
    zIndex: -1,
    elevation: 0,
  },
  background: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  waveLayer: {
    position: 'absolute',
    top: -24,
    left: -12,
    right: -12,
    bottom: -24,
    opacity: 0.1,
  },
  waveImage: {
    width: undefined,
    height: undefined,
    flex: 1,
  },
  shadowLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
  },
  content: {
    flex: 1,
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
    marginLeft: 0,
    marginRight: 0,
  },
  list: {
    marginTop: 20,
    gap: 18,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowDisabled: {
    opacity: 0.46,
  },
  rowIcon: {
    width: 50,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.34)',
  },
  tierBadgePro: { backgroundColor: '#AEFFE8', borderColor: '#AEFFE8' },
  tierBadgeText: {
    color: 'rgba(255, 255, 255, 0.86)',
    fontSize: 12,
    fontWeight: '700',
  },
  tierBadgeTextPro: { color: '#0C4342' },
  rowEmoji: {
    fontSize: 40,
    lineHeight: 44,
  },
  leftHandedRowEmoji: {
    transform: [{ scaleX: -1 }],
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  rowRight: {
    marginLeft: 10,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rowLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  modeToggle: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 14,
    backgroundColor: 'rgba(46, 45, 34, 0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  modeOption: {
    minWidth: 50,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 7,
  },
  modeOptionSelected: {
    backgroundColor: 'rgba(246, 242, 227, 0.94)',
  },
  modeOptionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  modeOptionTextSelected: {
    color: '#4D4A3B',
  },
  binaryToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: 'center',
    backgroundColor: 'rgba(46, 45, 34, 0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  binaryToggleActive: {
    backgroundColor: 'rgba(246, 242, 227, 0.94)',
  },
  binaryToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(246, 242, 227, 0.72)',
  },
  binaryToggleKnobActive: {
    backgroundColor: '#4D4A3B',
    transform: [{ translateX: 20 }],
  },
  personalizationScroll: {
    flex: 1,
    marginTop: 18,
  },
  personalizationHeaderTitle: {
    fontSize: 20,
  },
  personalizationContent: {
    paddingBottom: 30,
    gap: 18,
  },
  baseStyleSetting: {
    gap: 8,
  },
  baseStyleRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  baseStyleBubble: {
    minHeight: 34,
    maxWidth: '56%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 17,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(246, 242, 227, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.70)',
  },
  baseStyleBubbleText: {
    flexShrink: 1,
    color: '#4D4A3B',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  baseStyleBubblePressed: {
    opacity: 0.76,
  },
  baseStyleNativeMenu: {
    width: 132,
    height: 38,
  },
  baseStyleModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46, 45, 34, 0.62)',
    padding: 20,
  },
  baseStyleModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.34)',
    padding: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 18,
  },
  baseStyleModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  baseStyleModalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  baseStyleModalCloseButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  baseStyleModalCloseButtonPressed: {
    backgroundColor: 'rgba(246, 242, 227, 0.16)',
  },
  baseStyleModalOptions: {
    gap: 2,
  },
  baseStyleModalOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  baseStyleModalOptionSelected: {
    backgroundColor: 'rgba(246, 242, 227, 0.94)',
  },
  baseStyleModalOptionPressed: {
    backgroundColor: 'rgba(246, 242, 227, 0.18)',
  },
  baseStyleModalOptionText: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  baseStyleModalOptionTextSelected: {
    color: '#4D4A3B',
    fontWeight: '900',
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  homePersonalizationHint: {
    marginTop: 18,
    color: 'rgba(255, 255, 255, 0.76)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  homeCardOrderList: {
    paddingTop: 18,
    gap: 10,
  },
  homeCardOrderRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(46, 45, 34, 0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  homeCardOrderRowActive: {
    opacity: 0.86,
    transform: [{ scale: 1.01 }],
  },
  homeCardDragHandle: {
    width: 34,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeCardOrderLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  errorText: {
    color: '#FFE2E2',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  saveButton: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(246, 242, 227, 0.94)',
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(46, 45, 34, 0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  saveButtonText: {
    color: '#4D4A3B',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  saveButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.70)',
  },
  lowerSwipeBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 20,
  },
});
