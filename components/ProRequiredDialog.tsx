import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MIcon from '@expo/vector-icons/MaterialCommunityIcons';

/** Tells a free user a feature needs Eazee Pro, in the gold Home style, without opening the paywall. */
export default function ProRequiredDialog({
  visible,
  message,
  onClose,
}: {
  visible: boolean;
  message: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <BlurView intensity={30} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <Pressable accessibilityLabel="Close" onPress={onClose} style={[StyleSheet.absoluteFill, styles.dim]} />
      <View pointerEvents="box-none" style={styles.overlay}>
        <LinearGradient
          accessibilityViewIsModal
          colors={['#F4EBC4', '#C9B77A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.badge}>
            <MIcon name="crown-outline" size={28} color="#6B5B2E" />
          </View>
          <Text accessibilityRole="header" style={styles.title}>You must be a Pro user</Text>
          <Text style={styles.body}>{message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>OK</Text>
          </Pressable>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    backgroundColor: 'rgba(46, 45, 34, 0.25)',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 18,
    paddingHorizontal: 22,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  title: {
    marginTop: 14,
    color: '#3D3A2E',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    color: '#5A5645',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
    marginTop: 20,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4D4A3B',
  },
  buttonText: {
    color: '#F4EBC4',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
  },
});
