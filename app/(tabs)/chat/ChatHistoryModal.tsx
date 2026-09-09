import React, { useEffect, useState } from 'react';
import MIcon from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ChatSessionListItem } from './types';

type ChatHistoryModalProps = {
  visible: boolean;
  sessions: ChatSessionListItem[];
  activeSessionId: string | null;
  showSummaries?: boolean;
  isLeftHanded?: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onTogglePin: (sessionId: string, pinned: boolean) => void;
  onDeleteSession: (sessionId: string) => void;
};

function formatChatDate(timestamp: number) {
  const value = timestamp || Date.now();
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function getSearchTerms(query: string) {
  return Array.from(new Set(
    query
      .trim()
      .toLocaleLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean)
  )).sort((left, right) => right.length - left.length);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesAnySearchTerm(value: string, query: string) {
  const searchTerms = getSearchTerms(query);
  if (!searchTerms.length) return false;

  const normalizedValue = value.toLocaleLowerCase();
  return searchTerms.some((term) => normalizedValue.includes(term));
}

function summaryAddsSearchContext(title: string, summary: string, query: string) {
  const searchTerms = getSearchTerms(query);
  if (!searchTerms.length) return false;

  const normalizedTitle = title.toLocaleLowerCase();
  const normalizedSummary = summary.toLocaleLowerCase();

  return searchTerms.some((term) => (
    normalizedSummary.includes(term) && !normalizedTitle.includes(term)
  ));
}

function searchMatchesSession(session: ChatSessionListItem, query: string) {
  const searchTerms = getSearchTerms(query);
  if (!searchTerms.length) return true;

  const content = [session.title, session.summary]
    .map((value) => String(value || '').toLocaleLowerCase())
    .join('\n');

  return searchTerms.every((term) => content.includes(term));
}

function getSummaryMatchSnippet(value: string, query: string) {
  const searchTerms = getSearchTerms(query);
  const summary = value.trim();
  if (!summary || !searchTerms.length) {
    return summary;
  }

  const normalizedSummary = summary.toLocaleLowerCase();
  let matchIndex = -1;
  let matchedTermLength = 0;

  for (const term of searchTerms) {
    const nextIndex = normalizedSummary.indexOf(term);
    if (nextIndex === -1) continue;
    if (matchIndex === -1 || nextIndex < matchIndex) {
      matchIndex = nextIndex;
      matchedTermLength = term.length;
    }
  }

  if (matchIndex === -1) {
    return summary;
  }

  const leadingWindow = 24;
  const trailingWindow = 34;
  let start = Math.max(0, matchIndex - leadingWindow);
  let end = Math.min(summary.length, matchIndex + matchedTermLength + trailingWindow);

  if (start > 0) {
    const nextBoundary = summary.indexOf(' ', start);
    if (nextBoundary !== -1 && nextBoundary < matchIndex) {
      start = nextBoundary + 1;
    }
  }

  if (end < summary.length) {
    const nextBoundary = summary.lastIndexOf(' ', end);
    if (nextBoundary !== -1 && nextBoundary > matchIndex) {
      end = nextBoundary;
    }
  }

  const prefix = start > 0 ? '... ' : '';
  const suffix = end < summary.length ? ' ...' : '';
  return `${prefix}${summary.slice(start, end).trim()}${suffix}`;
}

function renderHighlightedText(value: string, query: string) {
  const searchTerms = getSearchTerms(query);
  if (!searchTerms.length) {
    return value;
  }

  const matcher = new RegExp(`(${searchTerms.map(escapeRegExp).join('|')})`, 'gi');
  const normalizedTerms = new Set(searchTerms);

  return value.split(matcher).map((part, index) => {
    if (!normalizedTerms.has(part.toLocaleLowerCase())) {
      return part;
    }

    return (
      <Text
        key={`${part}-${index}`}
        style={{
          color: '#033937',
          backgroundColor: '#A6FFF1',
          fontWeight: '800',
        }}
      >
        {part}
      </Text>
    );
  });
}

function ChatHistoryRow({
  isActive,
  session,
  searchQuery,
  showSummaries,
  onDeleteSession,
  onSelectSession,
  onTogglePin,
}: {
  isActive: boolean;
  session: ChatSessionListItem;
  searchQuery: string;
  showSummaries?: boolean;
  onDeleteSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onTogglePin: (sessionId: string, pinned: boolean) => void;
}) {
  const title = session.title || 'New Chat';
  const summary = session.summary?.trim() || '';
  const hasSearchQuery = searchQuery.trim().length > 0;
  const titleMatchesSearch = includesAnySearchTerm(title, searchQuery);
  const summaryMatchesSearch = includesAnySearchTerm(summary, searchQuery);
  const shouldShowSummarySnippet = hasSearchQuery && summaryMatchesSearch && (
    !titleMatchesSearch || summaryAddsSearchContext(title, summary, searchQuery)
  );
  const shouldShowFullSummary = showSummaries && !hasSearchQuery;

  return (
    <TouchableOpacity
      onPress={() => onSelectSession(session.id)}
      style={{ marginBottom: 10 }}
    >
      <LinearGradient
        colors={isActive ? ['#04534D', '#032F2E'] : ['#067369', '#004643']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          minHeight: 56,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: 'rgba(173, 255, 240, 0.55)',
          paddingLeft: 38,
          paddingRight: 38,
          paddingVertical: 14,
          justifyContent: 'center',
          shadowColor: '#001A17',
          shadowOpacity: 0.22,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <TouchableOpacity
          onPress={() => onTogglePin(session.id, session.pinned)}
          style={{ position: 'absolute', top: 8, left: 10, zIndex: 2 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MIcon name={session.pinned ? 'pin' : 'pin-outline'} size={13} color={session.pinned ? '#FFFFFF' : '#21A19B'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDeleteSession(session.id)}
          style={{ position: 'absolute', top: 8, right: 10, zIndex: 2 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MIcon name="trash-can-outline" size={13} color="#137D78" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, color: '#F4FFFD', fontSize: 13, fontWeight: '700' }}>
            {renderHighlightedText(title, searchQuery)}
          </Text>
          <Text style={{ color: '#5CA49F', fontSize: 11, fontWeight: '500' }}>
            {formatChatDate(session.lastMessageAt || session.createdAt)}
          </Text>
        </View>
        {shouldShowSummarySnippet && (
          <Text
            style={{ color: '#D8FFFA', fontSize: 12, lineHeight: 17, marginTop: 8 }}
            numberOfLines={2}
          >
            {renderHighlightedText(getSummaryMatchSnippet(summary, searchQuery), searchQuery)}
          </Text>
        )}
        {shouldShowFullSummary && (
          <Text
            style={{ color: '#C7F6F1', fontSize: 12, lineHeight: 17, marginTop: 8 }}
            numberOfLines={3}
          >
            {summary || 'No summary saved yet.'}
          </Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function ChatHistoryModal({
  visible,
  sessions,
  activeSessionId,
  showSummaries = false,
  isLeftHanded = false,
  onClose,
  onSelectSession,
  onTogglePin,
  onDeleteSession,
}: ChatHistoryModalProps) {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) return;
    setIsSearchVisible(false);
    setSearchQuery('');
  }, [visible]);

  const matchingSessions = sessions.filter((session) => searchMatchesSession(session, searchQuery));
  const hasSearchQuery = searchQuery.trim().length > 0;
  const showsEmptySearchState = isSearchVisible && hasSearchQuery && matchingSessions.length === 0;

  const toggleSearch = () => {
    if (isSearchVisible) {
      setIsSearchVisible(false);
      setSearchQuery('');
      return;
    }
    setIsSearchVisible(true);
  };
  const searchButton = sessions.length > 0 ? (
    <TouchableOpacity
      onPress={toggleSearch}
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isSearchVisible ? 'rgba(37, 165, 157, 0.18)' : 'transparent',
      }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <MIcon name="magnify" size={22} color={isSearchVisible ? '#89FFF2' : '#1DAFB2'} />
    </TouchableOpacity>
  ) : null;
  const closeButton = (
    <TouchableOpacity
      onPress={onClose}
      style={{
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <MIcon name="close" size={28} color="#1DAFB2" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={1}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            position: 'absolute',
            top: 72,
            left: 16,
            right: 16,
            bottom: 188,
            backgroundColor: 'rgba(0, 60, 55, 0.92)',
            borderRadius: 28,
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14, minHeight: 34 }}>
            <Text style={{ color: '#3DC5B5', fontSize: 28, fontWeight: '700' }}>
              {showSummaries ? 'Chats TST' : 'Chats'}
            </Text>
            <View
              style={{
                position: 'absolute',
                top: '50%',
                marginTop: -16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                ...(isLeftHanded ? { left: 0 } : { right: 0 }),
              }}
            >
              {isLeftHanded ? closeButton : searchButton}
              {isLeftHanded ? searchButton : closeButton}
            </View>
          </View>
          {isSearchVisible && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(128, 255, 244, 0.36)',
                backgroundColor: 'rgba(1, 48, 45, 0.78)',
                paddingLeft: 12,
                paddingRight: 10,
                marginBottom: 14,
              }}
            >
              <MIcon name="magnify" size={18} color="#6FE8DB" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={visible}
                placeholder="Search chats"
                placeholderTextColor="rgba(190, 231, 225, 0.52)"
                selectionColor="#83FFF4"
                autoCorrect={false}
                autoCapitalize="none"
                style={{
                  flex: 1,
                  color: '#F4FFFD',
                  fontSize: 14,
                  paddingVertical: 11,
                  paddingHorizontal: 10,
                }}
              />
              {hasSearchQuery && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MIcon name="close-circle" size={18} color="#7EEDE0" />
                </TouchableOpacity>
              )}
            </View>
          )}
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {sessions.length === 0 && (
              <Text style={{ color: '#BEE7E1', textAlign: 'center', marginTop: 24 }}>No chats yet</Text>
            )}
            {showsEmptySearchState && (
              <Text style={{ color: '#BEE7E1', textAlign: 'center', marginTop: 24 }}>
                No chats match &quot;{searchQuery.trim()}&quot;
              </Text>
            )}
            {matchingSessions.map((session) => (
              <ChatHistoryRow
                key={session.id}
                isActive={session.id === activeSessionId}
                session={session}
                searchQuery={searchQuery}
                showSummaries={showSummaries}
                onDeleteSession={onDeleteSession}
                onSelectSession={onSelectSession}
                onTogglePin={onTogglePin}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
