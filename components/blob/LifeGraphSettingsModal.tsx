import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import {
  LIFE_GRAPH_MAX_NAME_LENGTH,
  LIFE_GRAPH_MAX_WEEKLY_TARGET,
  LIFE_GRAPH_MIN_WEEKLY_TARGET,
  parseLifeGraphKeywords,
  type LifeGraphNode,
  type LifeGraphNodeId,
  type LifeGraphNodeProgress,
  type LifeGraphSettings,
} from '@/lib/lifeGraph';

type DraftNode = Omit<LifeGraphNode, 'keywords'> & { keywordsText: string };

const SWITCH_TRACK_COLORS = { false: 'rgba(255, 255, 255, 0.22)', true: '#F6F2E3' };

function WeeklyTargetStepper({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Lower weekly target"
        disabled={disabled || value <= LIFE_GRAPH_MIN_WEEKLY_TARGET}
        hitSlop={6}
        onPress={() => onChange(value - 1)}
        style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="minus" size={16} color="#FFFFFF" />
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Raise weekly target"
        disabled={disabled || value >= LIFE_GRAPH_MAX_WEEKLY_TARGET}
        hitSlop={6}
        onPress={() => onChange(value + 1)}
        style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function NodeEditor({
  node,
  completedCount,
  onChange,
}: {
  node: DraftNode;
  completedCount: number;
  onChange: (patch: Partial<DraftNode>) => void;
}) {
  return (
    <View style={[styles.nodeCard, !node.enabled && styles.nodeCardDisabled]}>
      <View style={styles.nodeHeader}>
        <TextInput
          value={node.name}
          onChangeText={(name) => onChange({ name })}
          editable={node.enabled}
          maxLength={LIFE_GRAPH_MAX_NAME_LENGTH}
          placeholder="Node name"
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          style={styles.nameInput}
          accessibilityLabel="Node name"
        />
        <Switch
          value={node.enabled}
          onValueChange={(enabled) => onChange({ enabled })}
          trackColor={SWITCH_TRACK_COLORS}
          thumbColor={node.enabled ? '#4D4A3B' : '#F6F2E3'}
          accessibilityLabel={`Show ${node.name || 'node'} on the Droplet`}
        />
      </View>
      <TextInput
        value={node.keywordsText}
        onChangeText={(keywordsText) => onChange({ keywordsText })}
        editable={node.enabled}
        placeholder="Keywords, comma separated"
        placeholderTextColor="rgba(255, 255, 255, 0.5)"
        autoCapitalize="none"
        style={styles.keywordsInput}
        accessibilityLabel={`${node.name} keywords`}
      />
      <View style={styles.targetRow}>
        <Text style={styles.targetLabel}>
          {`This week ${completedCount} / ${node.weeklyTarget}`}
        </Text>
        <WeeklyTargetStepper
          value={node.weeklyTarget}
          disabled={!node.enabled}
          onChange={(weeklyTarget) => onChange({ weeklyTarget })}
        />
      </View>
    </View>
  );
}

function LifeGraphSettingsForm({
  settings,
  progress,
  onSave,
  onClose,
}: {
  settings: LifeGraphSettings;
  progress: Record<LifeGraphNodeId, LifeGraphNodeProgress>;
  onSave: (settings: LifeGraphSettings) => void;
  onClose: () => void;
}) {
  const [faceVisible, setFaceVisible] = useState(settings.faceVisible);
  const [draftNodes, setDraftNodes] = useState<DraftNode[]>(() =>
    settings.nodes.map(({ keywords, ...node }) => ({ ...node, keywordsText: keywords.join(', ') }))
  );

  const updateNode = (id: LifeGraphNodeId, patch: Partial<DraftNode>) => {
    setDraftNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)));
  };

  const handleSave = () => {
    onSave({
      faceVisible,
      nodes: draftNodes.map(({ keywordsText, ...node }, index) => ({
        ...node,
        name: node.name.trim() || settings.nodes[index].name,
        keywords: parseLifeGraphKeywords(keywordsText),
      })),
    });
    onClose();
  };

  return (
    <LinearGradient colors={['#8C8268', '#4D4A3B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Life graph</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close life graph settings"
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.faceRow}>
          <Text style={styles.faceLabel}>Show face</Text>
          <Switch
            value={faceVisible}
            onValueChange={setFaceVisible}
            trackColor={SWITCH_TRACK_COLORS}
            thumbColor={faceVisible ? '#4D4A3B' : '#F6F2E3'}
            accessibilityLabel="Show Droplet face"
          />
        </View>
        <Text style={styles.hint}>
          Each node grows as you complete tasks that mention its name or keywords. Growth resets every week.
        </Text>
        {draftNodes.map((node) => (
          <NodeEditor
            key={node.id}
            node={node}
            completedCount={progress[node.id].completedCount}
            onChange={(patch) => updateNode(node.id, patch)}
          />
        ))}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={handleSave}
        style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
      >
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>
    </LinearGradient>
  );
}

export default function LifeGraphSettingsModal({
  visible,
  settings,
  progress,
  onSave,
  onClose,
}: {
  visible: boolean;
  settings: LifeGraphSettings;
  progress: Record<LifeGraphNodeId, LifeGraphNodeProgress>;
  onSave: (settings: LifeGraphSettings) => void;
  onClose: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
        {/* Mounted only while open, so each opening starts from the saved settings. */}
        {visible && <LifeGraphSettingsForm settings={settings} progress={progress} onSave={onSave} onClose={onClose} />}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46, 45, 34, 0.62)',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '88%',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  pressed: {
    backgroundColor: 'rgba(246, 242, 227, 0.16)',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 10,
    paddingBottom: 4,
  },
  faceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  faceLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.76)',
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  nodeCard: {
    gap: 8,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(246, 242, 227, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  nodeCardDisabled: {
    opacity: 0.55,
  },
  nodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 4,
  },
  keywordsInput: {
    color: '#FFFFFF',
    fontSize: 13,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  targetLabel: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 12,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  stepperValue: {
    minWidth: 24,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  saveButton: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246, 242, 227, 0.94)',
  },
  saveButtonPressed: {
    opacity: 0.8,
  },
  saveButtonText: {
    color: '#4D4A3B',
    fontSize: 15,
    fontWeight: '900',
  },
});
