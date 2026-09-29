import React, { ReactNode, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleProp,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';

/** Content hidden below the fold by less than this is not worth a hint. */
const MORE_BELOW_THRESHOLD_PX = 24;

/**
 * A todo list page that shows a down arrow while more of the list sits below
 * the visible area. Scroll state lives here so scrolling never re-renders the
 * whole Todo screen.
 */
export default function WorkspaceScrollArea({
  scrollRef,
  style,
  contentContainerStyle,
  arrowColor,
  children,
}: {
  scrollRef: { current: ScrollView | null };
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  arrowColor: string;
  children: ReactNode;
}) {
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  // NestableScrollContainer keeps onScroll for itself, so the offset is only known when a scroll settles.
  const [scrollOffsetY, setScrollOffsetY] = useState(0);
  const hasMoreBelow =
    viewportHeight > 0 && contentHeight - viewportHeight - scrollOffsetY > MORE_BELOW_THRESHOLD_PX;

  const handleScrollSettled = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollOffsetY(event.nativeEvent.contentOffset.y);
  };

  return (
    <View style={{ flex: 1 }} onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}>
      <NestableScrollContainer
        ref={scrollRef as React.Ref<any>}
        style={style}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        overScrollMode="always"
        contentContainerStyle={contentContainerStyle}
        onContentSizeChange={(_, height) => setContentHeight(height)}
        onScrollEndDrag={handleScrollSettled}
        onMomentumScrollEnd={handleScrollSettled}
      >
        {children}
      </NestableScrollContainer>
      {hasMoreBelow && (
        <TouchableOpacity
          onPress={() => {
            scrollRef.current?.scrollToEnd({ animated: true });
            // Scrolls started from code do not fire the scroll-end events above.
            setScrollOffsetY(contentHeight - viewportHeight);
          }}
          accessibilityRole="button"
          accessibilityLabel="Scroll down for more"
          hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
          style={{
            position: 'absolute',
            bottom: 6,
            alignSelf: 'center',
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.18)',
          }}
        >
          <Ionicons name="chevron-down" size={22} color={arrowColor} />
        </TouchableOpacity>
      )}
    </View>
  );
}
