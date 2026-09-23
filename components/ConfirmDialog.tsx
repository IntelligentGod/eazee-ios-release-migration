import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'destructive' | 'neutral';
  onConfirm: () => void;
  onCancel: () => void;
};

const DIALOG_GRADIENT: [string, string] = ['rgba(9, 12, 13, 0.98)', 'rgba(20, 108, 92, 0.96)'];
const DESTRUCTIVE = '#FF6B63';
const NEUTRAL = '#4FE3C1';

export default function ConfirmDialog({
  visible,
  title,
  message,
  icon = 'alert-circle-outline',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'destructive',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const appearAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appearAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 140,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [appearAnim, visible]);

  const accent = tone === 'destructive' ? DESTRUCTIVE : NEUTRAL;

  return (
    <Modal
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: appearAnim }]}>
          <Pressable accessibilityRole="button" onPress={onCancel} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <Animated.View
          style={[
            styles.cardWrapper,
            {
              opacity: appearAnim,
              transform: [
                {
                  translateY: appearAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
                {
                  scale: appearAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={DIALOG_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={[styles.iconRing, { borderColor: `${accent}55` }]}>
              <Ionicons name={icon} size={26} color={accent} />
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={onCancel}
                style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelLabel}>{cancelLabel}</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={onConfirm}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: accent },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.confirmLabel}>{confirmLabel}</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 7, 10, 0.62)',
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 360,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 14,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  title: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 22,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  cancelLabel: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmLabel: {
    color: '#08201C',
    fontSize: 15,
    fontWeight: '800',
  },
});
