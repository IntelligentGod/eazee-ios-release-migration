import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import SimpleScreen from '@/components/SimpleScreen';
import { useAuthSession } from './context/AuthSessionContext';
import {
  addMemory,
  deleteAllMemories,
  deleteMemory,
  editMemory,
  readCachedMemories,
  refreshMemories,
  setMemoryEnabled,
  subscribeMemories,
  type Memory,
  type MemoryState,
} from '@/lib/memories';

const ACCENT = '#0F5A4D';
const ACCENT_SOFT = '#0B7A69';

/** Settings → Memory: what Eazee remembers about the user, to review, edit or delete. */
export default function MemoriesScreen() {
  const { user } = useAuthSession();
  const uid = user?.uid ?? null;
  const [state, setState] = useState<MemoryState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [newMemory, setNewMemory] = useState('');

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void readCachedMemories(uid).then((cached) => {
      if (!cancelled) setState(cached);
    });
    void refreshMemories(uid)
      .then((latest) => {
        if (!cancelled) setState(latest);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Couldn’t load your memories right now. Showing what’s saved on this phone.');
      });
    const unsubscribe = subscribeMemories((value, changedUserId) => {
      if (changedUserId === uid) setState(value);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid]);

  const run = (action: () => Promise<unknown>) => {
    void action().catch((error) => Alert.alert('Not saved', (error as Error)?.message || 'Please try again.'));
  };

  if (!uid || !state) {
    return (
      <SimpleScreen title="Memory">
        <View style={styles.center}>
          {uid ? <ActivityIndicator color={ACCENT} /> : <Text style={styles.body}>Sign in to use memory.</Text>}
        </View>
      </SimpleScreen>
    );
  }

  const sorted = [...state.memories].sort((a, b) => b.updatedAt - a.updatedAt);

  const saveEdit = (memory: Memory) => {
    const text = draft.trim();
    setEditingId(null);
    if (!text || text === memory.text) return;
    run(() => editMemory(uid, memory.id, text));
  };

  return (
    <SimpleScreen title="Memory" subtitle="What Eazee remembers about you">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={[styles.cardTitle, { flex: 1 }]}>Remember things about me</Text>
            <Switch
              value={state.enabled}
              onValueChange={(enabled) => run(() => setMemoryEnabled(uid, enabled))}
              trackColor={{ true: ACCENT_SOFT, false: 'rgba(15, 90, 77, 0.2)' }}
              thumbColor="#FFFFFF"
            />
          </View>
          <Text style={styles.hint}>
            {state.enabled
              ? 'Eazee notes lasting things you tell it (your work, people in your life, routines) and uses them in future chats. It never saves sensitive details unless you ask. You’ll see “Remembered: …” under a reply when it saves something.'
              : 'Memory is off: Eazee won’t remember anything new or use what’s saved. Your saved memories are kept until you delete them.'}
          </Text>
        </View>

        {!!loadError && <Text style={styles.error}>{loadError}</Text>}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{`Saved memories (${sorted.length})`}</Text>
          {!sorted.length && (
            <Text style={styles.hint}>Nothing yet. Tell Eazee about yourself in a chat, or add something below.</Text>
          )}
          {sorted.map((memory) => (
            <View key={memory.id} style={styles.memoryRow}>
              {editingId === memory.id ? (
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={() => saveEdit(memory)}
                  onBlur={() => saveEdit(memory)}
                  autoFocus
                  maxLength={200}
                  style={[styles.input, { flex: 1 }]}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit memory: ${memory.text}`}
                  style={{ flex: 1 }}
                  onPress={() => {
                    setEditingId(memory.id);
                    setDraft(memory.text);
                  }}
                >
                  <Text style={styles.memoryText}>{memory.text}</Text>
                  <Text style={styles.memoryMeta}>
                    {`${memory.source === 'settings' ? 'Added by you' : 'From chat'} · ${new Date(memory.updatedAt).toLocaleDateString()}`}
                  </Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete memory: ${memory.text}`}
                hitSlop={10}
                onPress={() => run(() => deleteMemory(uid, memory.id))}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add a memory</Text>
          <TextInput
            value={newMemory}
            onChangeText={setNewMemory}
            placeholder="e.g. Works night shifts on weekends"
            placeholderTextColor="rgba(15, 90, 77, 0.45)"
            maxLength={200}
            editable={state.enabled}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!state.enabled || newMemory.trim().length < 2}
            onPress={() => {
              const text = newMemory.trim();
              setNewMemory('');
              run(() => addMemory(uid, text, 'settings'));
            }}
            style={[styles.primary, (!state.enabled || newMemory.trim().length < 2) && { opacity: 0.5 }]}
          >
            <Text style={styles.primaryText}>Add</Text>
          </Pressable>
        </View>

        {sorted.length > 0 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => Alert.alert(
              'Delete all memories?',
              'Eazee will forget everything it remembered about you, on every device. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete all', style: 'destructive', onPress: () => run(() => deleteAllMemories(uid)) },
              ]
            )}
            style={styles.secondary}
          >
            <Text style={[styles.secondaryText, { color: '#A33A2B' }]}>Delete all memories</Text>
          </Pressable>
        )}
      </ScrollView>
    </SimpleScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 20, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: ACCENT },
  body: { fontSize: 15, lineHeight: 21, color: '#173F38' },
  hint: { fontSize: 13, lineHeight: 18, color: ACCENT_SOFT },
  error: { fontSize: 13, color: '#A33A2B', textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15, 90, 77, 0.1)',
  },
  memoryText: { fontSize: 15, lineHeight: 20, color: '#173F38' },
  memoryMeta: { fontSize: 12, color: ACCENT_SOFT, marginTop: 2 },
  deleteText: { fontSize: 14, fontWeight: '700', color: '#A33A2B' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 90, 77, 0.25)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#173F38',
  },
  primary: { backgroundColor: ACCENT, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondary: { borderRadius: 999, paddingVertical: 12, alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.55)' },
  secondaryText: { color: ACCENT, fontSize: 15, fontWeight: '700' },
});
