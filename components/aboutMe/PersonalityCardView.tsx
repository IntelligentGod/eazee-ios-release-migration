import React, { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type PersonalityCardContent = {
  title: string;
  caption: string;
  superpower: string;
  plotTwist: string;
  move: string;
  /** e.g. "Playful take on your self-reported ENFP". */
  basisLabel: string;
};

/**
 * The shareable card, 4:5 (saved as 1080 x 1350). It shows only the joke: no name, photo,
 * age, work, goals, chat text, scores or answers.
 */
const PersonalityCardView = forwardRef<View, { content: PersonalityCardContent; width: number }>(
  function PersonalityCardView({ content, width }, ref) {
    // Everything is sized from the width so the saved image matches the preview.
    const unit = width / 360;
    const size = (value: number) => Math.round(value * unit * 10) / 10;
    return (
      <View ref={ref} collapsable={false} style={{ width, height: width * 1.25, borderRadius: size(28), overflow: 'hidden' }}>
        <LinearGradient
          colors={['#0E7465', '#05504A', '#032E2A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { padding: size(28), justifyContent: 'space-between' }]}
        >
          <View style={{ gap: size(14) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: size(8) }}>
              <Image source={require('../../assets/images/eazee-logo-big.png')} style={{ width: size(30), height: size(30) }} />
              <Text style={{ color: '#AEFFE8', fontSize: size(12), fontWeight: '800', letterSpacing: size(1.6) }}>
                YOUR EAZEE PERSONALITY
              </Text>
            </View>
            <Text
              style={{ color: '#FFFFFF', fontSize: size(31), lineHeight: size(35), fontWeight: '900', letterSpacing: size(0.3) }}
              numberOfLines={3}
              adjustsFontSizeToFit
            >
              {content.title.toUpperCase()}
            </Text>
            <Text style={{ color: '#E8FFFA', fontSize: size(16), lineHeight: size(22), fontWeight: '600' }} numberOfLines={4}>
              {`“${content.caption}”`}
            </Text>
          </View>

          <View style={{ gap: size(12) }}>
            {[
              ['SUPERPOWER', content.superpower],
              ['PLOT TWIST', content.plotTwist],
              ['YOUR EAZEE MOVE', content.move],
            ].map(([label, value]) => (
              <View key={label} style={{ gap: size(2) }}>
                <Text style={{ color: '#AEFFE8', fontSize: size(11), fontWeight: '800', letterSpacing: size(1.4) }}>{label}</Text>
                <Text style={{ color: '#FFFFFF', fontSize: size(17), fontWeight: '700' }} numberOfLines={2}>{value}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: size(4) }}>
            <Text style={{ color: 'rgba(232, 255, 250, 0.7)', fontSize: size(11) }} numberOfLines={1}>{content.basisLabel}</Text>
            <Text style={{ color: 'rgba(232, 255, 250, 0.85)', fontSize: size(11), fontWeight: '700' }}>
              A playful personality snapshot • eazee.ai
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
  }
);

export default PersonalityCardView;
